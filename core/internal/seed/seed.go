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

// Fixed UUIDs for dev seed data — match public/mock/services.json in the shell repo
// and the VITE_TENANT_ID / VITE_PORTAL_ID defaults in shell/.env.
var (
	platformTenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	adminPortalID    = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	managerServiceID = uuid.MustParse("00000000-0000-0000-0000-000000000010")
)

func Run(ctx context.Context, db *pgxpool.Pool, cfg config.SeedConfig, env string, log *zap.Logger) error {
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		log.Info("seed skipped: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set")
		return nil
	}

	if env == "production" {
		log.Warn("seed: SEED_ADMIN_EMAIL/PASSWORD are set in production — remove them after first deploy")
	}

	var exists bool
	if err := db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND role = 'superadmin')`,
		cfg.AdminEmail,
	).Scan(&exists); err != nil {
		return err
	}
	if exists {
		log.Info("seed skipped: superadmin already exists", zap.String("email", cfg.AdminEmail))
		return nil
	}

	userRepo := repository.NewUserRepo(db)

	var planID uuid.UUID
	if err := db.QueryRow(ctx, `SELECT id FROM plans WHERE name = 'enterprise' LIMIT 1`).Scan(&planID); err != nil {
		return err
	}

	// Insert with deterministic UUID; on slug conflict keep the existing row.
	if _, err := db.Exec(ctx, `
		INSERT INTO tenants (id, slug, name, plan_id, status)
		VALUES ($1, 'platform', 'Platform', $2, 'active')
		ON CONFLICT (slug) DO NOTHING
	`, platformTenantID, planID); err != nil {
		return err
	}
	var tenantID uuid.UUID
	if err := db.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = 'platform'`).Scan(&tenantID); err != nil {
		return err
	}

	if _, err := userRepo.Create(ctx, domain.CreateUserInput{
		TenantID: tenantID,
		Email:    cfg.AdminEmail,
		Password: cfg.AdminPassword,
		Role:     domain.RoleSuperAdmin,
	}); err != nil {
		return err
	}

	if err := seedAdminPortal(ctx, db, tenantID, cfg, log); err != nil {
		return err
	}

	log.Info("seed: superadmin created", zap.String("email", cfg.AdminEmail))
	return nil
}

// seedAdminPortal creates the manager service, links it to the platform tenant,
// creates the admin portal, and registers the manager service in that portal.
func seedAdminPortal(ctx context.Context, db *pgxpool.Pool, tenantID uuid.UUID, cfg config.SeedConfig, log *zap.Logger) error {
	// 1. Service: manager (always update mfe_url + config to stay current with env vars)
	svcConfig, err := json.Marshal(map[string]any{
		"auth_mfe_url": cfg.LoginMFEURL,
		"auth_api_url": cfg.AuthAPIURL,
		"public":       false,
	})
	if err != nil {
		return err
	}

	if _, err := db.Exec(ctx, `
		INSERT INTO services (id, slug, name, mfe_url, config)
		VALUES ($1, 'manager', 'Manager', $2, $3)
		ON CONFLICT (slug) DO UPDATE SET mfe_url = EXCLUDED.mfe_url, config = EXCLUDED.config
	`, managerServiceID, cfg.ManagerMFEURL, svcConfig); err != nil {
		return err
	}
	var serviceID uuid.UUID
	if err := db.QueryRow(ctx, `SELECT id FROM services WHERE slug = 'manager'`).Scan(&serviceID); err != nil {
		return err
	}

	// 2. Tenant service: platform → manager
	if _, err := db.Exec(ctx, `
		INSERT INTO tenant_services (tenant_id, service_id, is_enabled)
		VALUES ($1, $2, TRUE)
		ON CONFLICT (tenant_id, service_id) DO UPDATE SET is_enabled = TRUE
	`, tenantID, serviceID); err != nil {
		return err
	}
	var tenantServiceID uuid.UUID
	if err := db.QueryRow(ctx, `
		SELECT id FROM tenant_services WHERE tenant_id = $1 AND service_id = $2
	`, tenantID, serviceID).Scan(&tenantServiceID); err != nil {
		return err
	}

	// 3. Portal: admin (deterministic UUID)
	if _, err := db.Exec(ctx, `
		INSERT INTO tenant_portals (id, tenant_id, slug, name)
		VALUES ($1, $2, 'admin', 'Admin Portal')
		ON CONFLICT (tenant_id, slug) DO NOTHING
	`, adminPortalID, tenantID); err != nil {
		return err
	}
	var portalID uuid.UUID
	if err := db.QueryRow(ctx, `
		SELECT id FROM tenant_portals WHERE tenant_id = $1 AND slug = 'admin'
	`, tenantID).Scan(&portalID); err != nil {
		return err
	}

	// 4. Portal service: admin portal → manager
	if _, err := db.Exec(ctx, `
		INSERT INTO portal_services (portal_id, tenant_service_id, is_enabled, sort_order)
		VALUES ($1, $2, TRUE, 1)
		ON CONFLICT (portal_id, tenant_service_id) DO NOTHING
	`, portalID, tenantServiceID); err != nil {
		return err
	}

	log.Info("seed: admin portal ready",
		zap.String("portal", "admin"),
		zap.String("service", "manager"),
		zap.Stringer("portal_id", portalID),
	)
	return nil
}
