package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/domain"
)

// Compile-time check that ServiceRepo satisfies the domain interface.
var _ domain.ServiceRepository = (*ServiceRepo)(nil)

type ServiceRepo struct {
	db *pgxpool.Pool
}

func NewServiceRepo(db *pgxpool.Pool) *ServiceRepo {
	return &ServiceRepo{db: db}
}

func (r *ServiceRepo) Create(ctx context.Context, input domain.CreateServiceInput) (*domain.Service, error) {
	var s domain.Service
	err := r.db.QueryRow(ctx, `
		INSERT INTO services (name, mfe_url, version, description, config)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, mfe_url, version, description, config, is_active, created_at, updated_at
	`, input.Name, input.MFEURL, input.Version, input.Description, input.Config).
		Scan(&s.ID, &s.Name, &s.MFEURL, &s.Version, &s.Description, &s.Config, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create service: %w", err)
	}
	return &s, nil
}

func (r *ServiceRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Service, error) {
	var s domain.Service
	err := r.db.QueryRow(ctx, `
		SELECT id, name, mfe_url, version, description, config, is_active, created_at, updated_at
		FROM services WHERE id = $1
	`, id).Scan(&s.ID, &s.Name, &s.MFEURL, &s.Version, &s.Description, &s.Config, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get service by id: %w", err)
	}
	return &s, nil
}

func (r *ServiceRepo) List(ctx context.Context, onlyActive bool) ([]*domain.Service, error) {
	q := `SELECT id, name, mfe_url, version, description, config, is_active, created_at, updated_at FROM services`
	if onlyActive {
		q += ` WHERE is_active = TRUE`
	}
	q += ` ORDER BY name`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}
	defer rows.Close()

	var services []*domain.Service
	for rows.Next() {
		var s domain.Service
		if err := rows.Scan(&s.ID, &s.Name, &s.MFEURL, &s.Version, &s.Description, &s.Config, &s.IsActive, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		services = append(services, &s)
	}
	return services, rows.Err()
}

func (r *ServiceRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateServiceInput) (*domain.Service, error) {
	var s domain.Service
	err := r.db.QueryRow(ctx, `
		UPDATE services SET
			name        = COALESCE($2, name),
			mfe_url     = COALESCE($3, mfe_url),
			version     = COALESCE($4, version),
			description = COALESCE($5, description),
			is_active   = COALESCE($6, is_active),
			updated_at  = NOW()
		WHERE id = $1
		RETURNING id, name, mfe_url, version, description, config, is_active, created_at, updated_at
	`, id, input.Name, input.MFEURL, input.Version, input.Description, input.IsActive).
		Scan(&s.ID, &s.Name, &s.MFEURL, &s.Version, &s.Description, &s.Config, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update service: %w", err)
	}
	return &s, nil
}

func (r *ServiceRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

