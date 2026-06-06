package seed

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/config"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/repository"
	"go.uber.org/zap"
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

	var tenantID uuid.UUID
	if err := db.QueryRow(ctx, `
		INSERT INTO tenants (slug, name, plan_id, status)
		VALUES ('platform', 'Platform', $1, 'active')
		ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
		RETURNING id
	`, planID).Scan(&tenantID); err != nil {
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

	log.Info("seed: superadmin created", zap.String("email", cfg.AdminEmail))
	return nil
}
