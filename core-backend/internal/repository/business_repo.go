package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.BusinessRepository = (*BusinessRepo)(nil)

type BusinessRepo struct {
	db *pgxpool.Pool
}

func NewBusinessRepo(db *pgxpool.Pool) *BusinessRepo {
	return &BusinessRepo{db: db}
}

// ListByService resolves serviceIdentifier against the services catalog (by
// id when it parses as a UUID, otherwise by name — services.slug was dropped
// in migrations/014 and never replaced at this portal-independent scope, so
// services.name, still globally unique, is the only stable non-UUID
// identifier left here), then returns every businesses row reachable
// through a tenant_services adhesion for that service. Mirrors
// TenantRepo.ListByService's UUID-or-identifier resolution pattern, but
// resolves directly against services/tenant_services — tenant_services and
// businesses are portal-independent by design (migrations/024, /025),
// so no portal_services join is involved here.
func (r *BusinessRepo) ListByService(ctx context.Context, serviceIdentifier string) ([]*domain.Business, error) {
	var (
		rows pgx.Rows
		err  error
	)

	if serviceID, parseErr := uuid.Parse(serviceIdentifier); parseErr == nil {
		rows, err = r.db.Query(ctx, `
			SELECT b.id, b.tenant_service_id, b.name, b.slug, COALESCE(b.config, '{}'::jsonb), b.status, b.created_at, b.updated_at
			FROM businesses b
			JOIN tenant_services ts ON ts.id = b.tenant_service_id
			JOIN services s        ON s.id = ts.service_id
			WHERE s.id = $1
			  AND ts.is_enabled = TRUE
			  AND s.is_active = TRUE
			ORDER BY b.created_at DESC
		`, serviceID)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT b.id, b.tenant_service_id, b.name, b.slug, COALESCE(b.config, '{}'::jsonb), b.status, b.created_at, b.updated_at
			FROM businesses b
			JOIN tenant_services ts ON ts.id = b.tenant_service_id
			JOIN services s        ON s.id = ts.service_id
			WHERE s.name = $1
			  AND ts.is_enabled = TRUE
			  AND s.is_active = TRUE
			ORDER BY b.created_at DESC
		`, serviceIdentifier)
	}
	if err != nil {
		return nil, fmt.Errorf("list businesses by service query: %w", err)
	}
	defer rows.Close()

	var businesses []*domain.Business
	for rows.Next() {
		var b domain.Business
		if err := rows.Scan(
			&b.ID, &b.TenantServiceID, &b.Name, &b.Slug, &b.Config, &b.Status, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan business: %w", err)
		}
		businesses = append(businesses, &b)
	}
	return businesses, rows.Err()
}
