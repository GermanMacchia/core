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
	PriceUSD    float64   `json:"price_usd"`
	Features    JSONMap   `json:"features"`
	CreatedAt   time.Time `json:"created_at"`
}

type Tenant struct {
	ID          uuid.UUID    `json:"id"`
	Slug        string       `json:"slug"`
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
	Slug        string     `json:"slug"`
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
	GetBySlug(ctx context.Context, slug string) (*Tenant, error)
	GetByDomain(ctx context.Context, domain string) (*Tenant, error)
	List(ctx context.Context, limit, offset int) ([]*Tenant, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateTenantInput) (*Tenant, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
