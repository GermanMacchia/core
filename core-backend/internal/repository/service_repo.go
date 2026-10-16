package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

// Compile-time check that ServiceRepo satisfies the domain interface.
var _ domain.ServiceRepository = (*ServiceRepo)(nil)

type ServiceRepo struct {
	db *pgxpool.Pool
}

func NewServiceRepo(db *pgxpool.Pool) *ServiceRepo {
	return &ServiceRepo{db: db}
}

// serviceColumns is the shared projection for a domain.Service. mfe_url and
// version are resolved from the linked deployment so the JSON shape stays
// unchanged for existing consumers. Callers alias the services row as "s"
// and the deployment as "d".
const serviceColumns = `
	s.id, s.name, s.deployment_id, d.name, d.url, d.version, s.description,
	s.config, s.is_active, s.requires_business, s.created_at, s.updated_at
`

func scanService(row rowScanner) (*domain.Service, error) {
	var s domain.Service
	if err := row.Scan(
		&s.ID, &s.Name, &s.DeploymentID, &s.DeploymentName, &s.MFEURL, &s.Version, &s.Description,
		&s.Config, &s.IsActive, &s.RequiresBusiness, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *ServiceRepo) Create(ctx context.Context, input domain.CreateServiceInput) (*domain.Service, error) {
	s, err := scanService(r.db.QueryRow(ctx, `
		WITH s AS (
			INSERT INTO services (name, deployment_id, description, config, requires_business)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING *
		)
		SELECT `+serviceColumns+`
		FROM s JOIN deployments d ON d.id = s.deployment_id
	`, input.Name, input.DeploymentID, input.Description, input.Config, input.RequiresBusiness))
	if err != nil {
		return nil, fmt.Errorf("create service: %w", err)
	}
	return s, nil
}

func (r *ServiceRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Service, error) {
	s, err := scanService(r.db.QueryRow(ctx, `
		SELECT `+serviceColumns+`
		FROM services s JOIN deployments d ON d.id = s.deployment_id
		WHERE s.id = $1
	`, id))
	if err != nil {
		return nil, fmt.Errorf("get service by id: %w", err)
	}
	return s, nil
}

func (r *ServiceRepo) List(ctx context.Context, onlyActive bool) ([]*domain.Service, error) {
	q := `SELECT ` + serviceColumns + ` FROM services s JOIN deployments d ON d.id = s.deployment_id`
	if onlyActive {
		q += ` WHERE s.is_active = TRUE`
	}
	q += ` ORDER BY s.name`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}
	defer rows.Close()

	var services []*domain.Service
	for rows.Next() {
		s, err := scanService(rows)
		if err != nil {
			return nil, err
		}
		services = append(services, s)
	}
	return services, rows.Err()
}

func (r *ServiceRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateServiceInput) (*domain.Service, error) {
	s, err := scanService(r.db.QueryRow(ctx, `
		WITH s AS (
			UPDATE services SET
				name              = COALESCE($2, name),
				deployment_id     = COALESCE($3, deployment_id),
				description       = COALESCE($4, description),
				is_active         = COALESCE($5, is_active),
				requires_business = COALESCE($6, requires_business),
				config            = CASE WHEN $7::jsonb IS NOT NULL THEN $7::jsonb ELSE config END,
				updated_at        = NOW()
			WHERE id = $1
			RETURNING *
		)
		SELECT `+serviceColumns+`
		FROM s JOIN deployments d ON d.id = s.deployment_id
	`, id, input.Name, input.DeploymentID, input.Description, input.IsActive, input.RequiresBusiness, input.Config))
	if err != nil {
		return nil, fmt.Errorf("update service: %w", err)
	}
	return s, nil
}

func (r *ServiceRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}
