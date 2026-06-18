package seed

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/config"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/repository"
	"go.uber.org/zap"
)

var (
	platformTenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	adminPortalID    = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	managerServiceID = uuid.MustParse("00000000-0000-0000-0000-000000000010")
	loginServiceID   = uuid.MustParse("00000000-0000-0000-0000-000000000011")
)

func Run(ctx context.Context, db *pgxpool.Pool, cfg config.SeedConfig, env string, log *zap.Logger) error {
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		log.Info("seed skipped: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set")
		return nil
	}

	if env == "production" {
		log.Warn("seed: SEED_ADMIN_EMAIL/PASSWORD are set in production — remove them after first deploy")
	}

	var planID uuid.UUID
	if err := db.QueryRow(ctx, `SELECT id FROM plans WHERE name = 'enterprise' LIMIT 1`).Scan(&planID); err != nil {
		return err
	}

	// Tenant and portal infra are always seeded — all statements are idempotent.
	if _, err := db.Exec(ctx, `
		INSERT INTO tenants (id, name, plan_id, status)
		VALUES ($1, 'Platform', $2, 'active')
		ON CONFLICT (id) DO NOTHING
	`, platformTenantID, planID); err != nil {
		return err
	}

	if err := seedAdminPortal(ctx, db, platformTenantID, cfg, log); err != nil {
		return err
	}

	// Superadmin user is only created once.
	var exists bool
	if err := db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM users u
			JOIN roles r ON r.id = u.role_id
			WHERE u.email = $1 AND r.name = 'superadmin'
		)`,
		cfg.AdminEmail,
	).Scan(&exists); err != nil {
		return err
	}
	if exists {
		log.Info("seed: superadmin already exists", zap.String("email", cfg.AdminEmail))
		return nil
	}

	userRepo := repository.NewUserRepo(db)
	if _, err := userRepo.Create(ctx, domain.CreateUserInput{
		TenantID: platformTenantID,
		Email:    cfg.AdminEmail,
		Password: cfg.AdminPassword,
		Role:     domain.RoleSuperAdmin,
	}); err != nil {
		return err
	}

	log.Info("seed: superadmin created", zap.String("email", cfg.AdminEmail))
	return nil
}

func seedAdminPortal(ctx context.Context, db *pgxpool.Pool, tenantID uuid.UUID, cfg config.SeedConfig, log *zap.Logger) error {
	// Login service (public, activates at / and /login)
	loginConfig, err := json.Marshal(map[string]any{
		"public": true,
	})
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO services (id, name, mfe_url, config)
		VALUES ($1, 'Login', $2, $3)
		ON CONFLICT (id) DO UPDATE SET mfe_url = EXCLUDED.mfe_url, config = EXCLUDED.config
	`, loginServiceID, cfg.LoginMFEURL, loginConfig); err != nil {
		return err
	}

	svcConfig, err := json.Marshal(map[string]any{
		"public": false,
	})
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO services (id, name, mfe_url, config)
		VALUES ($1, 'Manager', $2, $3)
		ON CONFLICT (id) DO UPDATE SET mfe_url = EXCLUDED.mfe_url, config = EXCLUDED.config
	`, managerServiceID, cfg.ManagerMFEURL, svcConfig); err != nil {
		return err
	}

	// Portal config holds auth_api_url as fallback for services
	portalConfig, err := json.Marshal(map[string]any{
		"auth_api_url": cfg.AuthAPIURL,
		"login_slug":   "login",
	})
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO tenant_portals (id, tenant_id, name, config)
		VALUES ($1, $2, 'Admin Portal', $3)
		ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config
	`, adminPortalID, tenantID, portalConfig); err != nil {
		return err
	}
	portalID := adminPortalID

	// Assign services directly to the portal with their routing slugs and order
	type portalSvc struct {
		svcID uuid.UUID
		slug  string
		order int
	}
	for _, ps := range []portalSvc{
		{loginServiceID, "login", 0},
		{managerServiceID, "manager", 1},
	} {
		if _, err := db.Exec(ctx, `
			INSERT INTO portal_services (portal_id, service_id, slug, sort_order, is_enabled)
			VALUES ($1, $2, $3, $4, TRUE)
			ON CONFLICT (portal_id, service_id) DO UPDATE
				SET slug = EXCLUDED.slug, sort_order = EXCLUDED.sort_order, is_enabled = TRUE
		`, portalID, ps.svcID, ps.slug, ps.order); err != nil {
			return err
		}
	}

	log.Info("seed: admin portal ready",
		zap.String("portal", "admin"),
		zap.Stringer("portal_id", portalID),
	)
	return nil
}
