package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	MFEURL           string    `json:"mfe_url"`
	Version          string    `json:"version"`
	Description      *string   `json:"description,omitempty"`
	Config           JSONMap   `json:"config"`
	IsActive         bool      `json:"is_active"`
	RequiresInstance bool      `json:"requires_instance"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type CreateServiceInput struct {
	Name             string  `json:"name"`
	MFEURL           string  `json:"mfe_url"`
	Version          string  `json:"version"`
	Description      *string `json:"description,omitempty"`
	Config           JSONMap `json:"config"`
	RequiresInstance *bool   `json:"requires_instance,omitempty"`
}

type UpdateServiceInput struct {
	Name             *string `json:"name,omitempty"`
	MFEURL           *string `json:"mfe_url,omitempty"`
	Version          *string `json:"version,omitempty"`
	Description      *string `json:"description,omitempty"`
	IsActive         *bool   `json:"is_active,omitempty"`
	Config           JSONMap `json:"config,omitempty"`
	RequiresInstance *bool   `json:"requires_instance,omitempty"`
}

// TenantService is a Service adhered to directly by a tenant (tenant_services),
// independent of portal delivery.
type TenantService struct {
	ID               uuid.UUID              `json:"id"` // service_id
	Name             string                 `json:"name"`
	MFEURL           string                 `json:"mfe_url"`
	IsEnabled        bool                   `json:"is_enabled"`
	RequiresInstance bool                   `json:"requires_instance"`
	Instance         *TenantServiceInstance `json:"instance,omitempty"`
}

type ServiceRepository interface {
	Create(ctx context.Context, input CreateServiceInput) (*Service, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Service, error)
	List(ctx context.Context, onlyActive bool) ([]*Service, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateServiceInput) (*Service, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
