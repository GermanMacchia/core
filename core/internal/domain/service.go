package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	MFEURL      string    `json:"mfe_url"`
	Version     string    `json:"version"`
	Description *string   `json:"description,omitempty"`
	Config      JSONMap   `json:"config"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TenantService struct {
	ID        uuid.UUID  `json:"id"`
	TenantID  uuid.UUID  `json:"tenant_id"`
	ServiceID uuid.UUID  `json:"service_id"`
	Slug      string     `json:"slug"`
	Service   *Service   `json:"service,omitempty"`
	IsEnabled bool       `json:"is_enabled"`
	EnabledAt time.Time  `json:"enabled_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type CreateServiceInput struct {
	Name        string  `json:"name"`
	MFEURL      string  `json:"mfe_url"`
	Version     string  `json:"version"`
	Description *string `json:"description,omitempty"`
	Config      JSONMap `json:"config"`
}

type UpdateServiceInput struct {
	Name        *string `json:"name,omitempty"`
	MFEURL      *string `json:"mfe_url,omitempty"`
	Version     *string `json:"version,omitempty"`
	Description *string `json:"description,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

type EnableServiceInput struct {
	TenantID  uuid.UUID  `json:"tenant_id"`
	ServiceID uuid.UUID  `json:"service_id"`
	Slug      string     `json:"slug"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type ServiceRepository interface {
	Create(ctx context.Context, input CreateServiceInput) (*Service, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Service, error)
	List(ctx context.Context, onlyActive bool) ([]*Service, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateServiceInput) (*Service, error)
	Delete(ctx context.Context, id uuid.UUID) error
	EnableForTenant(ctx context.Context, input EnableServiceInput) (*TenantService, error)
	DisableForTenant(ctx context.Context, tenantID, serviceID uuid.UUID) error
	GetTenantServices(ctx context.Context, tenantID uuid.UUID) ([]*TenantService, error)
}
