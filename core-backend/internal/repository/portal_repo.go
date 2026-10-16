package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.PortalRepository = (*PortalRepo)(nil)

type PortalRepo struct {
	db *pgxpool.Pool
}

func NewPortalRepo(db *pgxpool.Pool) *PortalRepo {
	return &PortalRepo{db: db}
}

func (r *PortalRepo) ListAll(ctx context.Context) ([]*domain.Portal, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.tenant_id, t.name, p.name, p.domain, p.description, p.config, p.is_active, p.created_at, p.updated_at
		FROM tenant_portals p
		JOIN tenants t ON t.id = p.tenant_id
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list all portals: %w", err)
	}
	defer rows.Close()

	var result []*domain.Portal
	for rows.Next() {
		var p domain.Portal
		if err := rows.Scan(
			&p.ID, &p.TenantID, &p.TenantName, &p.Name, &p.Domain, &p.Description,
			&p.Config, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, &p)
	}
	return result, rows.Err()
}

func (r *PortalRepo) ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]*domain.Portal, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, tenant_id, name, domain, description, config, is_active, created_at, updated_at
		FROM tenant_portals
		WHERE tenant_id = $1
		ORDER BY created_at
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list portals: %w", err)
	}
	defer rows.Close()

	var result []*domain.Portal
	for rows.Next() {
		var p domain.Portal
		if err := rows.Scan(
			&p.ID, &p.TenantID, &p.Name, &p.Domain, &p.Description,
			&p.Config, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, &p)
	}
	return result, rows.Err()
}

func (r *PortalRepo) Create(ctx context.Context, input domain.CreatePortalInput) (*domain.Portal, error) {
	var p domain.Portal
	err := r.db.QueryRow(ctx, `
		INSERT INTO tenant_portals (tenant_id, name, domain, description, config)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, tenant_id, name, domain, description, config, is_active, created_at, updated_at
	`, input.TenantID, input.Name, input.Domain, input.Description, input.Config).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Domain, &p.Description,
		&p.Config, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create portal: %w", err)
	}
	return &p, nil
}

func (r *PortalRepo) GetByID(ctx context.Context, portalID, tenantID uuid.UUID) (*domain.Portal, error) {
	var p domain.Portal
	err := r.db.QueryRow(ctx, `
		SELECT id, tenant_id, name, domain, description, config, is_active, created_at, updated_at
		FROM tenant_portals
		WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE
	`, portalID, tenantID).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Domain, &p.Description,
		&p.Config, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get portal by id: %w", err)
	}
	return &p, nil
}

// GetTenantIDByPortalID resolves the owning tenant for a portal, without
// requiring the caller to already know the tenant. Used by
// authz.CanAccessPortal, where portal_id arrives from the URL alone.
func (r *PortalRepo) GetTenantIDByPortalID(ctx context.Context, portalID uuid.UUID) (uuid.UUID, error) {
	var tenantID uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT tenant_id FROM tenant_portals WHERE id = $1
	`, portalID).Scan(&tenantID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("get tenant id by portal id: %w", err)
	}
	return tenantID, nil
}

func (r *PortalRepo) Update(ctx context.Context, portalID uuid.UUID, input domain.UpdatePortalInput) (*domain.Portal, error) {
	isActive := pgtype.Bool{}
	if input.IsActive != nil {
		isActive = pgtype.Bool{Bool: *input.IsActive, Valid: true}
	}

	var p domain.Portal
	err := r.db.QueryRow(ctx, `
		UPDATE tenant_portals
		SET
			name        = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE name END,
			domain      = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE domain END,
			description = CASE WHEN $4::text IS NOT NULL THEN $4::text ELSE description END,
			is_active   = CASE WHEN $5::boolean IS NOT NULL THEN $5::boolean ELSE is_active END,
			config      = CASE WHEN $6::jsonb IS NOT NULL THEN $6::jsonb ELSE config END,
			updated_at  = NOW()
		WHERE id = $1
		RETURNING id, tenant_id, name, domain, description, config, is_active, created_at, updated_at
	`, portalID, input.Name, input.Domain, input.Description, isActive, input.Config).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Domain, &p.Description,
		&p.Config, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update portal: %w", err)
	}
	return &p, nil
}

func (r *PortalRepo) AssignService(ctx context.Context, input domain.AssignPortalServiceInput) (*domain.PortalService, error) {
	var ps domain.PortalService
	err := r.db.QueryRow(ctx, `
		WITH upsert AS (
			INSERT INTO portal_services (portal_id, service_id, slug, sort_order, expires_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (portal_id, service_id) DO UPDATE SET
				slug       = EXCLUDED.slug,
				sort_order = EXCLUDED.sort_order,
				is_enabled = TRUE,
				expires_at = EXCLUDED.expires_at,
				enabled_at = NOW()
			RETURNING service_id, slug, sort_order, config_override
		)
		SELECT
			u.service_id,
			u.slug,
			s.name,
			d.url AS mfe_url,
			d.name AS deployment_name,
			s.config || u.config_override AS config,
			u.sort_order
		FROM upsert u
		JOIN services s ON s.id = u.service_id
		JOIN deployments d ON d.id = s.deployment_id
	`, input.PortalID, input.ServiceID, input.Slug, input.SortOrder, input.ExpiresAt).
		Scan(&ps.ServiceID, &ps.Slug, &ps.Name, &ps.MFEURL, &ps.DeploymentName, &ps.Config, &ps.SortOrder)
	if err != nil {
		return nil, fmt.Errorf("assign portal service: %w", err)
	}
	return &ps, nil
}

func (r *PortalRepo) UpdatePortalService(ctx context.Context, portalID, serviceID uuid.UUID, input domain.UpdatePortalServiceInput) (*domain.PortalService, error) {
	sortOrder := pgtype.Int4{}
	if input.SortOrder != nil {
		sortOrder = pgtype.Int4{Int32: int32(*input.SortOrder), Valid: true}
	}

	var ps domain.PortalService
	err := r.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE portal_services
			SET
				slug            = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE slug END,
				sort_order      = CASE WHEN $4::integer IS NOT NULL THEN $4::integer ELSE sort_order END,
				config_override = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE config_override END,
				expires_at      = CASE WHEN $6::timestamptz IS NOT NULL THEN $6::timestamptz ELSE expires_at END
			WHERE portal_id = $1 AND service_id = $2
			RETURNING portal_id, service_id, slug, sort_order, config_override
		)
		SELECT
			u.service_id,
			u.slug,
			s.name,
			d.url AS mfe_url,
			d.name AS deployment_name,
			s.config || u.config_override AS config,
			u.sort_order
		FROM updated u
		JOIN services s ON s.id = u.service_id
		JOIN deployments d ON d.id = s.deployment_id
	`, portalID, serviceID, input.Slug, sortOrder, input.ConfigOverride, input.ExpiresAt).
		Scan(&ps.ServiceID, &ps.Slug, &ps.Name, &ps.MFEURL, &ps.DeploymentName, &ps.Config, &ps.SortOrder)
	if err != nil {
		return nil, fmt.Errorf("update portal service: %w", err)
	}
	return &ps, nil
}

func (r *PortalRepo) UnassignService(ctx context.Context, portalID, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE portal_services SET is_enabled = FALSE WHERE portal_id = $1 AND service_id = $2`,
		portalID, serviceID,
	)
	return err
}

func (r *PortalRepo) GetServices(ctx context.Context, portalID uuid.UUID) ([]*domain.PortalService, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id,
			ps.slug,
			s.name,
			d.url AS mfe_url,
			d.name AS deployment_name,
			s.config || ps.config_override AS config,
			ps.sort_order
		FROM portal_services ps
		JOIN services s ON s.id = ps.service_id
		JOIN deployments d ON d.id = s.deployment_id
		WHERE ps.portal_id  = $1
		  AND ps.is_enabled = TRUE
		  AND s.is_active   = TRUE
		ORDER BY ps.sort_order, s.name
	`, portalID)
	if err != nil {
		return nil, fmt.Errorf("get portal services: %w", err)
	}
	defer rows.Close()

	var result []*domain.PortalService
	for rows.Next() {
		var ps domain.PortalService
		if err := rows.Scan(
			&ps.ServiceID, &ps.Slug, &ps.Name, &ps.MFEURL, &ps.DeploymentName,
			&ps.Config, &ps.SortOrder,
		); err != nil {
			return nil, err
		}
		result = append(result, &ps)
	}
	return result, rows.Err()
}

// ListServicesByTenant returns the distinct enabled services across all portals of a tenant.
func (r *PortalRepo) ListServicesByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.PortalService, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT ON (ps.service_id)
			s.id,
			ps.slug,
			s.name,
			d.url AS mfe_url,
			d.name AS deployment_name,
			s.config || ps.config_override AS config,
			ps.sort_order
		FROM portal_services ps
		JOIN tenant_portals p ON p.id = ps.portal_id
		JOIN services s       ON s.id = ps.service_id
		JOIN deployments d    ON d.id = s.deployment_id
		WHERE p.tenant_id  = $1
		  AND ps.is_enabled = TRUE
		  AND s.is_active   = TRUE
		ORDER BY ps.service_id, ps.slug
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list tenant services: %w", err)
	}
	defer rows.Close()

	var result []*domain.PortalService
	for rows.Next() {
		var ps domain.PortalService
		if err := rows.Scan(
			&ps.ServiceID, &ps.Slug, &ps.Name, &ps.MFEURL, &ps.DeploymentName,
			&ps.Config, &ps.SortOrder,
		); err != nil {
			return nil, err
		}
		result = append(result, &ps)
	}
	return result, rows.Err()
}
