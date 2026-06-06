package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	MFEURL      string    `json:"mfe_url"`
	APIURL      *string   `json:"api_url,omitempty"`
	Version     string    `json:"version"`
	Description *string   `json:"description,omitempty"`
	Config      JSONMap   `json:"config"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TenantService struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	ServiceID      uuid.UUID  `json:"service_id"`
	Service        *Service   `json:"service,omitempty"`
	IsEnabled      bool       `json:"is_enabled"`
	ConfigOverride JSONMap    `json:"config_override"`
	EnabledAt      time.Time  `json:"enabled_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

type CreateServiceInput struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	MFEURL      string  `json:"mfe_url"`
	APIURL      *string `json:"api_url,omitempty"`
	Version     string  `json:"version"`
	Description *string `json:"description,omitempty"`
	Config      JSONMap `json:"config"`
}

type EnableServiceInput struct {
	TenantID       uuid.UUID  `json:"tenant_id"`
	ServiceID      uuid.UUID  `json:"service_id"`
	ConfigOverride JSONMap    `json:"config_override"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

type ServiceRepository interface {
	Create(ctx context.Context, input CreateServiceInput) (*Service, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Service, error)
	GetBySlug(ctx context.Context, slug string) (*Service, error)
	List(ctx context.Context, onlyActive bool) ([]*Service, error)
	EnableForTenant(ctx context.Context, input EnableServiceInput) (*TenantService, error)
	DisableForTenant(ctx context.Context, tenantID, serviceID uuid.UUID) error
	GetTenantServices(ctx context.Context, tenantID uuid.UUID) ([]*TenantService, error)
}
