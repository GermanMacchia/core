// Command backfill-user-access is a one-off migration helper for
// migrations/032 (see migrations/031_create_user_service_access.sql). It must
// be run once, after 031 is applied.
//
// It grants every existing admin/member/viewer user access on EVERY
// service_instances row under their own tenant (preserving today's effective
// blanket per-tenant access — the safest default now that access is
// per-instance instead of implicit), and grants every existing superadmin
// user access on the Platform tenant's Manager instance (core-admin staff
// access). It resolves each grant's role_id to the per-service role cloned by
// migrations/030 (matched by name + service_id), never to the original global
// role row.
//
// It is safe to re-run: every insert is idempotent
// (ON CONFLICT (user_id, service_instance_id) DO NOTHING).
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
				logger.Warn("superadmin user granted zero instances (no Manager instance found under Platform tenant)",
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

// grantSuperadmin grants userID access to every service_instances row found
// under the Platform tenant's Manager adhesion (there should be exactly one,
// per today's 1:1 backfill), using superadmin's own role row as role_id — its
// service_id was repointed to Manager by migrations/030. Returns the number
// of grants inserted (0 or 1 under today's data shape).
func grantSuperadmin(ctx context.Context, tx pgx.Tx, userID uuid.UUID) (int, error) {
	rows, err := tx.Query(ctx, `
		SELECT si.id
		FROM service_instances si
		JOIN tenant_services ts ON ts.id = si.tenant_service_id
		WHERE ts.tenant_id = $1 AND ts.service_id = $2
	`, platformTenantID, managerServiceID)
	if err != nil {
		return 0, err
	}
	var instanceIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, err
		}
		instanceIDs = append(instanceIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	inserted := 0
	for _, instanceID := range instanceIDs {
		tag, err := tx.Exec(ctx, `
			INSERT INTO user_service_access (user_id, service_instance_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, service_instance_id) DO NOTHING
		`, userID, instanceID, superadminRoleID)
		if err != nil {
			return inserted, err
		}
		inserted += int(tag.RowsAffected())
	}
	return inserted, nil
}

// grantTenantBlanketAccess grants u access to every service_instances row
// under its own tenant, resolving role_id to the per-service clone of u's
// current role name (created by migrations/030). Returns
// (grants inserted, instances skipped for lacking a matching cloned role).
func grantTenantBlanketAccess(ctx context.Context, tx pgx.Tx, u userRow) (int, int, error) {
	rows, err := tx.Query(ctx, `
		SELECT si.id, ts.service_id
		FROM service_instances si
		JOIN tenant_services ts ON ts.id = si.tenant_service_id
		WHERE ts.tenant_id = $1
	`, u.tenantID)
	if err != nil {
		return 0, 0, err
	}
	type instanceService struct {
		instanceID uuid.UUID
		serviceID  uuid.UUID
	}
	var instances []instanceService
	for rows.Next() {
		var is instanceService
		if err := rows.Scan(&is.instanceID, &is.serviceID); err != nil {
			rows.Close()
			return 0, 0, err
		}
		instances = append(instances, is)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	inserted, skipped := 0, 0
	for _, is := range instances {
		var roleID uuid.UUID
		err := tx.QueryRow(ctx, `
			SELECT id FROM roles WHERE name = $1 AND service_id = $2
		`, u.roleName, is.serviceID).Scan(&roleID)
		if err != nil {
			if err == pgx.ErrNoRows {
				skipped++
				continue
			}
			return inserted, skipped, err
		}

		tag, err := tx.Exec(ctx, `
			INSERT INTO user_service_access (user_id, service_instance_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, service_instance_id) DO NOTHING
		`, u.id, is.instanceID, roleID)
		if err != nil {
			return inserted, skipped, err
		}
		inserted += int(tag.RowsAffected())
	}
	return inserted, skipped, nil
}
