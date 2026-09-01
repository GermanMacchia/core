package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.ServiceInstanceRepository = (*ServiceInstanceRepo)(nil)

type ServiceInstanceRepo struct {
	db *pgxpool.Pool
}

func NewServiceInstanceRepo(db *pgxpool.Pool) *ServiceInstanceRepo {
	return &ServiceInstanceRepo{db: db}
}

// ListByService resolves serviceIdentifier against the services catalog (by
// id when it parses as a UUID, otherwise by name — services.slug was dropped
// in migrations/014 and never replaced at this portal-independent scope, so
// services.name, still globally unique, is the only stable non-UUID
// identifier left here), then returns every service_instances row reachable
// through a tenant_services adhesion for that service. Mirrors
// TenantRepo.ListByService's UUID-or-identifier resolution pattern, but
// resolves directly against services/tenant_services — tenant_services and
// service_instances are portal-independent by design (migrations/024, /025),
// so no portal_services join is involved here.
func (r *ServiceInstanceRepo) ListByService(ctx context.Context, serviceIdentifier string) ([]*domain.ServiceInstance, error) {
	var (
		rows pgx.Rows
		err  error
	)

	if serviceID, parseErr := uuid.Parse(serviceIdentifier); parseErr == nil {
		rows, err = r.db.Query(ctx, `
			SELECT si.id, si.tenant_service_id, si.name, si.slug, COALESCE(si.config, '{}'::jsonb), si.status, si.created_at, si.updated_at
			FROM service_instances si
			JOIN tenant_services ts ON ts.id = si.tenant_service_id
			JOIN services s        ON s.id = ts.service_id
			WHERE s.id = $1
			  AND ts.is_enabled = TRUE
			  AND s.is_active = TRUE
			ORDER BY si.created_at DESC
		`, serviceID)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT si.id, si.tenant_service_id, si.name, si.slug, COALESCE(si.config, '{}'::jsonb), si.status, si.created_at, si.updated_at
			FROM service_instances si
			JOIN tenant_services ts ON ts.id = si.tenant_service_id
			JOIN services s        ON s.id = ts.service_id
			WHERE s.name = $1
			  AND ts.is_enabled = TRUE
			  AND s.is_active = TRUE
			ORDER BY si.created_at DESC
		`, serviceIdentifier)
	}
	if err != nil {
		return nil, fmt.Errorf("list service instances by service query: %w", err)
	}
	defer rows.Close()

	var instances []*domain.ServiceInstance
	for rows.Next() {
		var si domain.ServiceInstance
		if err := rows.Scan(
			&si.ID, &si.TenantServiceID, &si.Name, &si.Slug, &si.Config, &si.Status, &si.CreatedAt, &si.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan service instance: %w", err)
		}
		instances = append(instances, &si)
	}
	return instances, rows.Err()
}
