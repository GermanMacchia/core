package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.PlanRepository = (*PlanRepo)(nil)

type PlanRepo struct {
	db *pgxpool.Pool
}

func NewPlanRepo(db *pgxpool.Pool) *PlanRepo {
	return &PlanRepo{db: db}
}

func (r *PlanRepo) List(ctx context.Context) ([]*domain.Plan, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, max_users, max_services, price, features, created_at
		FROM plans
		ORDER BY price
	`)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []*domain.Plan
	for rows.Next() {
		var p domain.Plan
		if err := rows.Scan(
			&p.ID, &p.Name, &p.MaxUsers, &p.MaxServices, &p.Price, &p.Features, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		plans = append(plans, &p)
	}
	return plans, rows.Err()
}

func (r *PlanRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Plan, error) {
	var p domain.Plan
	err := r.db.QueryRow(ctx, `
		SELECT id, name, max_users, max_services, price, features, created_at
		FROM plans WHERE id = $1
	`, id).Scan(&p.ID, &p.Name, &p.MaxUsers, &p.MaxServices, &p.Price, &p.Features, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	return &p, nil
}

func (r *PlanRepo) Create(ctx context.Context, input domain.CreatePlanInput) (*domain.Plan, error) {
	featJSON, err := json.Marshal(input.Features)
	if err != nil || featJSON == nil {
		featJSON = []byte("{}")
	}

	var p domain.Plan
	err = r.db.QueryRow(ctx, `
		INSERT INTO plans (name, max_users, max_services, price, features)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, max_users, max_services, price, features, created_at
	`, input.Name, input.MaxUsers, input.MaxServices, input.Price, featJSON).Scan(
		&p.ID, &p.Name, &p.MaxUsers, &p.MaxServices, &p.Price, &p.Features, &p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return &p, nil
}

func (r *PlanRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdatePlanInput) (*domain.Plan, error) {
	args := []any{}
	setClauses := []string{}
	idx := 1

	if input.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", idx))
		args = append(args, *input.Name)
		idx++
	}
	if input.MaxUsers != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_users = $%d", idx))
		args = append(args, *input.MaxUsers)
		idx++
	}
	if input.MaxServices != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_services = $%d", idx))
		args = append(args, *input.MaxServices)
		idx++
	}
	if input.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", idx))
		args = append(args, *input.Price)
		idx++
	}
	if input.Features != nil {
		featJSON, err := json.Marshal(input.Features)
		if err != nil {
			return nil, fmt.Errorf("marshal features: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("features = $%d", idx))
		args = append(args, featJSON)
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, id)
	}

	args = append(args, id)
	query := fmt.Sprintf(
		"UPDATE plans SET %s WHERE id = $%d RETURNING id, name, max_users, max_services, price, features, created_at",
		strings.Join(setClauses, ", "), idx,
	)

	var p domain.Plan
	if err := r.db.QueryRow(ctx, query, args...).Scan(
		&p.ID, &p.Name, &p.MaxUsers, &p.MaxServices, &p.Price, &p.Features, &p.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("update plan: %w", err)
	}
	return &p, nil
}

func (r *PlanRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM plans WHERE id = $1", id)
	return err
}

func (r *PlanRepo) ListServicePricing(ctx context.Context, planID uuid.UUID) ([]*domain.PlanServicePricing, error) {
	rows, err := r.db.Query(ctx, `
		SELECT psp.id, psp.plan_id, psp.service_id,
		       s.name, s.mfe_url, s.version, s.is_active,
		       psp.price, psp.is_included, psp.created_at
		FROM plan_service_pricing psp
		JOIN services s ON s.id = psp.service_id
		WHERE psp.plan_id = $1
		ORDER BY s.name
	`, planID)
	if err != nil {
		return nil, fmt.Errorf("list service pricing: %w", err)
	}
	defer rows.Close()

	var result []*domain.PlanServicePricing
	for rows.Next() {
		var psp domain.PlanServicePricing
		var svc domain.Service
		if err := rows.Scan(
			&psp.ID, &psp.PlanID, &psp.ServiceID,
			&svc.Name, &svc.MFEURL, &svc.Version, &svc.IsActive,
			&psp.Price, &psp.IsIncluded, &psp.CreatedAt,
		); err != nil {
			return nil, err
		}
		svc.ID = psp.ServiceID
		psp.Service = &svc
		result = append(result, &psp)
	}
	return result, rows.Err()
}

func (r *PlanRepo) SetServicePricing(ctx context.Context, planID uuid.UUID, input domain.SetServicePricingInput) (*domain.PlanServicePricing, error) {
	var psp domain.PlanServicePricing
	err := r.db.QueryRow(ctx, `
		INSERT INTO plan_service_pricing (plan_id, service_id, price, is_included)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (plan_id, service_id) DO UPDATE
			SET price = EXCLUDED.price, is_included = EXCLUDED.is_included
		RETURNING id, plan_id, service_id, price, is_included, created_at
	`, planID, input.ServiceID, input.Price, input.IsIncluded).Scan(
		&psp.ID, &psp.PlanID, &psp.ServiceID, &psp.Price, &psp.IsIncluded, &psp.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("set service pricing: %w", err)
	}

	var svc domain.Service
	if err := r.db.QueryRow(ctx, `
		SELECT id, name, mfe_url, version, is_active FROM services WHERE id = $1
	`, input.ServiceID).Scan(&svc.ID, &svc.Name, &svc.MFEURL, &svc.Version, &svc.IsActive); err == nil {
		psp.Service = &svc
	}

	return &psp, nil
}

func (r *PlanRepo) RemoveServicePricing(ctx context.Context, planID uuid.UUID, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM plan_service_pricing WHERE plan_id = $1 AND service_id = $2
	`, planID, serviceID)
	return err
}
