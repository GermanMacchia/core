package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/slugutil"
)

type TenantServiceRepo struct {
	db *pgxpool.Pool
}

func NewTenantServiceRepo(db *pgxpool.Pool) *TenantServiceRepo {
	return &TenantServiceRepo{db: db}
}

// tenantServiceSelect is the shared column list/join shape used by
// ListByTenant and getOne to build a domain.TenantService (with its nested
// TenantServiceInstance, when one exists). si.* columns come back SQL NULL
// when the LEFT JOIN finds no service_instances row; si.config is additionally
// wrapped in COALESCE so it always scans as valid (possibly empty) JSON.
const tenantServiceSelect = `
	SELECT s.id, s.name, d.url, d.name, ts.is_enabled, s.requires_instance,
	       si.id, si.name, si.slug, COALESCE(si.config, '{}'::jsonb)
	FROM tenant_services ts
	JOIN services s ON s.id = ts.service_id
	JOIN deployments d ON d.id = s.deployment_id
	LEFT JOIN service_instances si ON si.tenant_service_id = ts.id
`

// rowScanner is satisfied by both pgx.Row (QueryRow) and pgx.Rows (Query),
// letting scanTenantService serve both ListByTenant and getOne.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanTenantService(row rowScanner) (*domain.TenantService, error) {
	var (
		ts           domain.TenantService
		instanceID   *uuid.UUID
		instanceName *string
		instanceSlug *string
		instanceCfg  domain.JSONMap
	)
	if err := row.Scan(
		&ts.ID, &ts.Name, &ts.MFEURL, &ts.DeploymentName, &ts.IsEnabled, &ts.RequiresInstance,
		&instanceID, &instanceName, &instanceSlug, &instanceCfg,
	); err != nil {
		return nil, err
	}

	if instanceID != nil {
		inst := domain.TenantServiceInstance{ID: *instanceID, Config: instanceCfg}
		if instanceName != nil {
			inst.Name = *instanceName
		}
		if instanceSlug != nil {
			inst.Slug = *instanceSlug
		}
		ts.Instance = &inst
	}

	return &ts, nil
}

func (r *TenantServiceRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.TenantService, error) {
	rows, err := r.db.Query(ctx, tenantServiceSelect+`
		WHERE ts.tenant_id = $1 AND ts.is_enabled = TRUE AND s.is_active = TRUE
		ORDER BY s.name
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list tenant services: %w", err)
	}
	defer rows.Close()

	var result []*domain.TenantService
	for rows.Next() {
		ts, err := scanTenantService(rows)
		if err != nil {
			return nil, fmt.Errorf("scan tenant service: %w", err)
		}
		result = append(result, ts)
	}
	return result, rows.Err()
}

// getOne builds the full TenantService (service + adhesion + instance) for a
// single tenant/service pair. Used to build the response after AssignService.
func (r *TenantServiceRepo) getOne(ctx context.Context, tenantID, serviceID uuid.UUID) (*domain.TenantService, error) {
	row := r.db.QueryRow(ctx, tenantServiceSelect+`
		WHERE ts.tenant_id = $1 AND ts.service_id = $2
	`, tenantID, serviceID)

	ts, err := scanTenantService(row)
	if err != nil {
		return nil, fmt.Errorf("get tenant service: %w", err)
	}
	return ts, nil
}

func (r *TenantServiceRepo) AssignService(ctx context.Context, tenantID, serviceID uuid.UUID) (*domain.TenantService, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	var tenantServiceID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO tenant_services (tenant_id, service_id, is_enabled)
		VALUES ($1, $2, TRUE)
		ON CONFLICT (tenant_id, service_id) DO UPDATE SET is_enabled = TRUE
		RETURNING id
	`, tenantID, serviceID).Scan(&tenantServiceID)
	if err != nil {
		return nil, fmt.Errorf("upsert tenant service: %w", err)
	}

	var requiresInstance bool
	if err := tx.QueryRow(ctx, `SELECT requires_instance FROM services WHERE id = $1`, serviceID).Scan(&requiresInstance); err != nil {
		return nil, fmt.Errorf("get service requires_instance: %w", err)
	}

	if requiresInstance {
		var instanceID uuid.UUID
		err = tx.QueryRow(ctx, `SELECT id FROM service_instances WHERE tenant_service_id = $1`, tenantServiceID).Scan(&instanceID)
		if err != nil && err != pgx.ErrNoRows {
			return nil, fmt.Errorf("check service instance: %w", err)
		}
		if err == pgx.ErrNoRows {
			var tenantName string
			if err := tx.QueryRow(ctx, `SELECT name FROM tenants WHERE id = $1`, tenantID).Scan(&tenantName); err != nil {
				return nil, fmt.Errorf("get tenant name: %w", err)
			}

			base := slugutil.Slugify(tenantName)
			if base == "" {
				base = "tenant-" + tenantServiceID.String()[:8]
			}

			// The slug is the negocio's public address within its service, so
			// it must not collide with another tenant's negocio there.
			slug, err := slugutil.Unique(base, func(candidate string) (bool, error) {
				var exists bool
				err := tx.QueryRow(ctx, `
					SELECT EXISTS (SELECT 1 FROM service_instances WHERE service_id = $1 AND slug = $2)
				`, serviceID, candidate).Scan(&exists)
				return exists, err
			})
			if err != nil {
				return nil, fmt.Errorf("resolve unique instance slug: %w", err)
			}

			if _, err := tx.Exec(ctx, `
				INSERT INTO service_instances (tenant_service_id, service_id, name, slug)
				VALUES ($1, $2, $3, $4)
			`, tenantServiceID, serviceID, tenantName, slug); err != nil {
				return nil, fmt.Errorf("insert service instance: %w", err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.getOne(ctx, tenantID, serviceID)
}

func (r *TenantServiceRepo) UnassignService(ctx context.Context, tenantID, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE tenant_services SET is_enabled = FALSE WHERE tenant_id = $1 AND service_id = $2`,
		tenantID, serviceID,
	)
	return err
}

// UpdateInstance partially updates the service_instances ("negocio") row
// belonging to a tenant's adhesion to a service. name is applied via
// COALESCE (nil leaves it unchanged); config, when non-nil, is shallow-merged
// on top of the existing config via jsonb `||` (nil leaves it unchanged —
// pgx encodes a nil domain.JSONMap as SQL NULL, not JSON "null"). slug, like
// name, is applied via COALESCE; the caller validates its format, and a slug
// already used by another negocio of the same service surfaces as a wrapped
// SQLSTATE 23505 (UNIQUE(service_id, slug), migrations/035).
// Returns pgx.ErrNoRows (wrapped) when no matching instance exists so the
// handler can translate it to a 404.
func (r *TenantServiceRepo) UpdateInstance(ctx context.Context, tenantID, serviceID uuid.UUID, name, slug *string, config domain.JSONMap) (*domain.TenantServiceInstance, error) {
	var inst domain.TenantServiceInstance
	err := r.db.QueryRow(ctx, `
		UPDATE service_instances si
		SET name = COALESCE($3, si.name),
		    slug = COALESCE($5, si.slug),
		    config = CASE WHEN $4::jsonb IS NOT NULL THEN si.config || $4::jsonb ELSE si.config END,
		    updated_at = NOW()
		FROM tenant_services ts
		WHERE si.tenant_service_id = ts.id AND ts.tenant_id = $1 AND ts.service_id = $2
		RETURNING si.id, si.name, si.slug, si.config
	`, tenantID, serviceID, name, config, slug).Scan(&inst.ID, &inst.Name, &inst.Slug, &inst.Config)
	if err != nil {
		return nil, fmt.Errorf("update service instance: %w", err)
	}
	return &inst, nil
}
