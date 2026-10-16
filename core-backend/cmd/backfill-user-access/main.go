// Command backfill-user-access is a one-off migration helper for
// migrations/032 (see migrations/031_create_user_service_access.sql). It must
// be run once, after 031 is applied. Its SQL now targets the post-038 schema
// (businesses / user_service_access.business_id), so re-running it requires
// migration 038.
//
// It grants every existing admin/member/viewer user access on EVERY
// businesses row under their own tenant (preserving today's effective
// blanket per-tenant access — the safest default now that access is
// per-business instead of implicit), and grants every existing superadmin
// user access on the Platform tenant's Manager business (core-admin staff
// access). It resolves each grant's role_id to the per-service role cloned by
// migrations/030 (matched by name + service_id), never to the original global
// role row.
//
// It is safe to re-run: every insert is idempotent
// (ON CONFLICT (user_id, business_id) DO NOTHING).
//
// Usage: go run ./cmd/backfill-user-access
package main

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/tu-org/core-backend/internal/config"
	"github.com/tu-org/core-backend/internal/db"
)

var (
	platformTenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	managerServiceID = uuid.MustParse("00000000-0000-0000-0000-000000000010")
	superadminRoleID = uuid.MustParse("00000000-0000-0000-0000-000000000101")
)

type userRow struct {
	id       uuid.UUID
	tenantID uuid.UUID
	roleName string
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("load config", zap.Error(err))
	}

	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DB)
	if err != nil {
		logger.Fatal("connect db", zap.Error(err))
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		logger.Fatal("begin tx", zap.Error(err))
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	users, err := loadUsers(ctx, tx)
	if err != nil {
		logger.Fatal("load users", zap.Error(err))
	}

	grantCount := 0
	skipCount := 0

	for _, u := range users {
		switch u.roleName {
		case "superadmin":
			n, err := grantSuperadmin(ctx, tx, u.id)
			if err != nil {
				logger.Fatal("grant superadmin", zap.Stringer("user_id", u.id), zap.Error(err))
			}
			grantCount += n
			if n == 0 {
				logger.Warn("superadmin user granted zero businesses (no Manager business found under Platform tenant)",
					zap.Stringer("user_id", u.id))
			}

		case "admin", "member", "viewer":
			n, s, err := grantTenantBlanketAccess(ctx, tx, u)
			if err != nil {
				logger.Fatal("grant tenant blanket access", zap.Stringer("user_id", u.id), zap.Error(err))
			}
			grantCount += n
			skipCount += s

		default:
			logger.Warn("skipping user with unrecognized role",
				zap.Stringer("user_id", u.id), zap.String("role", u.roleName))
			skipCount++
		}
	}

	if err := tx.Commit(ctx); err != nil {
		logger.Fatal("commit tx", zap.Error(err))
	}

	logger.Info("backfill-user-access complete",
		zap.Int("grants_inserted", grantCount),
		zap.Int("skipped", skipCount),
	)
}

func loadUsers(ctx context.Context, tx pgx.Tx) ([]userRow, error) {
	rows, err := tx.Query(ctx, `
		SELECT u.id, u.tenant_id, r.name
		FROM users u
		JOIN roles r ON r.id = u.role_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.id, &u.tenantID, &u.roleName); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// grantSuperadmin grants userID access to every businesses row found
// under the Platform tenant's Manager adhesion (there should be exactly one,
// per today's 1:1 backfill), using superadmin's own role row as role_id — its
// service_id was repointed to Manager by migrations/030. Returns the number
// of grants inserted (0 or 1 under today's data shape).
func grantSuperadmin(ctx context.Context, tx pgx.Tx, userID uuid.UUID) (int, error) {
	rows, err := tx.Query(ctx, `
		SELECT b.id
		FROM businesses b
		JOIN tenant_services ts ON ts.id = b.tenant_service_id
		WHERE ts.tenant_id = $1 AND ts.service_id = $2
	`, platformTenantID, managerServiceID)
	if err != nil {
		return 0, err
	}
	var businessIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, err
		}
		businessIDs = append(businessIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	inserted := 0
	for _, businessID := range businessIDs {
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_service_access (user_id, business_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, business_id) DO NOTHING
		`, userID, businessID, superadminRoleID)
		if err != nil {
			return inserted, err
		}
		inserted += int(tag.RowsAffected())
	}
	return inserted, nil
}

// grantTenantBlanketAccess grants u access to every businesses row
// under its own tenant, resolving role_id to the per-service clone of u's
// current role name (created by migrations/030). Returns
// (grants inserted, businesses skipped for lacking a matching cloned role).
func grantTenantBlanketAccess(ctx context.Context, tx pgx.Tx, u userRow) (int, int, error) {
	rows, err := tx.Query(ctx, `
		SELECT b.id, ts.service_id
		FROM businesses b
		JOIN tenant_services ts ON ts.id = b.tenant_service_id
		WHERE ts.tenant_id = $1
	`, u.tenantID)
	if err != nil {
		return 0, 0, err
	}
	type businessService struct {
		businessID uuid.UUID
		serviceID  uuid.UUID
	}
	var businesses []businessService
	for rows.Next() {
		var bs businessService
		if err := rows.Scan(&bs.businessID, &bs.serviceID); err != nil {
			rows.Close()
			return 0, 0, err
		}
		businesses = append(businesses, bs)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	inserted, skipped := 0, 0
	for _, bs := range businesses {
		var roleID uuid.UUID
		err := tx.QueryRow(ctx, `
			SELECT id FROM roles WHERE name = $1 AND service_id = $2
		`, u.roleName, bs.serviceID).Scan(&roleID)
		if err != nil {
			if err == pgx.ErrNoRows {
				skipped++
				continue
			}
			return inserted, skipped, err
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO user_service_access (user_id, business_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, business_id) DO NOTHING
		`, u.id, bs.businessID, roleID)
		if err != nil {
			return inserted, skipped, err
		}
		inserted += int(tag.RowsAffected())
	}
	return inserted, skipped, nil
}
