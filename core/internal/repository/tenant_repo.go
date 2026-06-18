package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/domain"
)

type TenantRepo struct {
	db *pgxpool.Pool
}

func NewTenantRepo(db *pgxpool.Pool) *TenantRepo {
	return &TenantRepo{db: db}
}

func (r *TenantRepo) Create(ctx context.Context, input domain.CreateTenantInput) (*domain.Tenant, error) {
	var t domain.Tenant
	err := r.db.QueryRow(ctx, `
		INSERT INTO tenants (name, domain, plan_id, status, trial_ends_at)
		VALUES ($1, $2, $3, 'active', $4)
		RETURNING id, name, domain, plan_id, status, config, trial_ends_at, created_at, updated_at
	`, input.Name, input.Domain, input.PlanID, input.TrialEndsAt).
		Scan(&t.ID, &t.Name, &t.Domain, &t.PlanID, &t.Status, &t.Config, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create tenant: %w", err)
	}
	return &t, nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	var t domain.Tenant
	var plan domain.Plan
	err := r.db.QueryRow(ctx, `
		SELECT t.id, t.name, t.domain, t.plan_id, t.status, t.config, t.trial_ends_at, t.created_at, t.updated_at,
		       p.id, p.name, p.max_users, p.max_services, p.price, p.features, p.created_at
		FROM tenants t
		JOIN plans p ON p.id = t.plan_id
		WHERE t.id = $1
	`, id).Scan(
		&t.ID, &t.Name, &t.Domain, &t.PlanID, &t.Status, &t.Config, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt,
		&plan.ID, &plan.Name, &plan.MaxUsers, &plan.MaxServices, &plan.Price, &plan.Features, &plan.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get tenant by id: %w", err)
	}
	t.Plan = &plan
	return &t, nil
}

func (r *TenantRepo) GetByDomain(ctx context.Context, domain_ string) (*domain.Tenant, error) {
	var t domain.Tenant
	var plan domain.Plan
	err := r.db.QueryRow(ctx, `
		SELECT t.id, t.name, t.domain, t.plan_id, t.status, t.config, t.trial_ends_at, t.created_at, t.updated_at,
		       p.id, p.name, p.max_users, p.max_services, p.price, p.features, p.created_at
		FROM tenants t
		JOIN plans p ON p.id = t.plan_id
		WHERE t.domain = $1
	`, domain_).Scan(
		&t.ID, &t.Name, &t.Domain, &t.PlanID, &t.Status, &t.Config, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt,
		&plan.ID, &plan.Name, &plan.MaxUsers, &plan.MaxServices, &plan.Price, &plan.Features, &plan.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get tenant by domain: %w", err)
	}
	t.Plan = &plan
	return &t, nil
}

func (r *TenantRepo) List(ctx context.Context, limit, offset int) ([]*domain.Tenant, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.name, t.domain, t.plan_id, t.status, t.config, t.trial_ends_at, t.created_at, t.updated_at,
		       p.id, p.name, p.max_users, p.max_services, p.price, p.features, p.created_at
		FROM tenants t
		JOIN plans p ON p.id = t.plan_id
		ORDER BY t.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list tenants: %w", err)
	}
	defer rows.Close()

	var tenants []*domain.Tenant
	for rows.Next() {
		var t domain.Tenant
		var plan domain.Plan
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Domain, &t.PlanID, &t.Status, &t.Config, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt,
			&plan.ID, &plan.Name, &plan.MaxUsers, &plan.MaxServices, &plan.Price, &plan.Features, &plan.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.Plan = &plan
		tenants = append(tenants, &t)
	}
	return tenants, rows.Err()
}

func (r *TenantRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateTenantInput) (*domain.Tenant, error) {
	var t domain.Tenant
	err := r.db.QueryRow(ctx, `
		UPDATE tenants SET
			name          = COALESCE($2, name),
			domain        = COALESCE($3, domain),
			status        = COALESCE($4, status),
			config        = COALESCE($5, config),
			trial_ends_at = COALESCE($6, trial_ends_at),
			updated_at    = NOW()
		WHERE id = $1
		RETURNING id, name, domain, plan_id, status, config, trial_ends_at, created_at, updated_at
	`, id, input.Name, input.Domain, input.Status, input.Config, input.TrialEndsAt).
		Scan(&t.ID, &t.Name, &t.Domain, &t.PlanID, &t.Status, &t.Config, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update tenant: %w", err)
	}
	return &t, nil
}

func (r *TenantRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE tenants SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, id)
	return err
}
