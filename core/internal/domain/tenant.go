package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "active"
	TenantStatusSuspended TenantStatus = "suspended"
	TenantStatusTrial     TenantStatus = "trial"
	TenantStatusCancelled TenantStatus = "cancelled"
)

type Plan struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	MaxUsers    int       `json:"max_users"`
	MaxServices int       `json:"max_services"`
	Price    float64   `json:"price"`
	Features    JSONMap   `json:"features"`
	CreatedAt   time.Time `json:"created_at"`
}

type Tenant struct {
	ID          uuid.UUID    `json:"id"`
	Name        string       `json:"name"`
	Domain      *string      `json:"domain,omitempty"`
	PlanID      uuid.UUID    `json:"plan_id"`
	Plan        *Plan        `json:"plan,omitempty"`
	Status      TenantStatus `json:"status"`
	Config      JSONMap      `json:"config"`
	TrialEndsAt *time.Time   `json:"trial_ends_at,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type CreateTenantInput struct {
	Name        string     `json:"name"`
	Domain      *string    `json:"domain,omitempty"`
	PlanID      uuid.UUID  `json:"plan_id"`
	TrialEndsAt *time.Time `json:"trial_ends_at,omitempty"`
}

type UpdateTenantInput struct {
	Name        *string       `json:"name,omitempty"`
	Domain      *string       `json:"domain,omitempty"`
	Status      *TenantStatus `json:"status,omitempty"`
	Config      JSONMap       `json:"config,omitempty"`
	TrialEndsAt *time.Time    `json:"trial_ends_at,omitempty"`
}

type JSONMap map[string]any

type TenantRepository interface {
	Create(ctx context.Context, input CreateTenantInput) (*Tenant, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	GetByDomain(ctx context.Context, domain string) (*Tenant, error)
	List(ctx context.Context, limit, offset int) ([]*Tenant, error)
	ListByService(ctx context.Context, serviceIdentifier string) ([]*Tenant, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateTenantInput) (*Tenant, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type CreatePlanInput struct {
	Name        string  `json:"name"`
	MaxUsers    int     `json:"max_users"`
	MaxServices int     `json:"max_services"`
	Price    float64 `json:"price"`
	Features    JSONMap `json:"features"`
}

type UpdatePlanInput struct {
	Name        *string  `json:"name,omitempty"`
	MaxUsers    *int     `json:"max_users,omitempty"`
	MaxServices *int     `json:"max_services,omitempty"`
	Price    *float64 `json:"price,omitempty"`
	Features    JSONMap  `json:"features,omitempty"`
}

type PlanServicePricing struct {
	ID         uuid.UUID `json:"id"`
	PlanID     uuid.UUID `json:"plan_id"`
	ServiceID  uuid.UUID `json:"service_id"`
	Service    *Service  `json:"service,omitempty"`
	Price   float64   `json:"price"`
	IsIncluded bool      `json:"is_included"`
	CreatedAt  time.Time `json:"created_at"`
}

type SetServicePricingInput struct {
	ServiceID  uuid.UUID `json:"service_id"`
	Price   float64   `json:"price"`
	IsIncluded bool      `json:"is_included"`
}

type PlanRepository interface {
	List(ctx context.Context) ([]*Plan, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Plan, error)
	Create(ctx context.Context, input CreatePlanInput) (*Plan, error)
	Update(ctx context.Context, id uuid.UUID, input UpdatePlanInput) (*Plan, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ListServicePricing(ctx context.Context, planID uuid.UUID) ([]*PlanServicePricing, error)
	SetServicePricing(ctx context.Context, planID uuid.UUID, input SetServicePricingInput) (*PlanServicePricing, error)
	RemoveServicePricing(ctx context.Context, planID uuid.UUID, serviceID uuid.UUID) error
}
