package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/domain"
)

type PortalRepo struct {
	db *pgxpool.Pool
}

func NewPortalRepo(db *pgxpool.Pool) *PortalRepo {
	return &PortalRepo{db: db}
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

func (r *PortalRepo) GetServices(ctx context.Context, portalID uuid.UUID) ([]*domain.PortalService, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id,
			ts.slug,
			s.name,
			s.mfe_url,
			s.config || ps.config_override AS config,
			ps.sort_order
		FROM portal_services ps
		JOIN tenant_services ts ON ts.id = ps.tenant_service_id
		JOIN services s         ON s.id  = ts.service_id
		WHERE ps.portal_id  = $1
		  AND ps.is_enabled = TRUE
		  AND ts.is_enabled = TRUE
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
			&ps.ServiceID, &ps.Slug, &ps.Name, &ps.MFEURL,
			&ps.Config, &ps.SortOrder,
		); err != nil {
			return nil, err
		}
		result = append(result, &ps)
	}
	return result, rows.Err()
}
