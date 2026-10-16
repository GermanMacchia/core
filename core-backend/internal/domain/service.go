package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	DeploymentID   uuid.UUID `json:"deployment_id"`
	DeploymentName string    `json:"deployment_name,omitempty"`
	// MFEURL and Version are resolved from the linked deployment (d.url,
	// d.version); they stay on the JSON shape for existing consumers.
	MFEURL           string    `json:"mfe_url"`
	Version          string    `json:"version"`
	Description      *string   `json:"description,omitempty"`
	Config           JSONMap   `json:"config"`
	IsActive         bool      `json:"is_active"`
	RequiresBusiness bool      `json:"requires_business"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type CreateServiceInput struct {
	Name             string    `json:"name"`
	DeploymentID     uuid.UUID `json:"deployment_id"`
	Description      *string   `json:"description,omitempty"`
	Config           JSONMap   `json:"config"`
	RequiresBusiness *bool     `json:"requires_business,omitempty"`
}

type UpdateServiceInput struct {
	Name             *string    `json:"name,omitempty"`
	DeploymentID     *uuid.UUID `json:"deployment_id,omitempty"`
	Description      *string    `json:"description,omitempty"`
	IsActive         *bool      `json:"is_active,omitempty"`
	Config           JSONMap    `json:"config,omitempty"`
	RequiresBusiness *bool      `json:"requires_business,omitempty"`
}

// TenantService is a Service adhered to directly by a tenant (tenant_services),
// independent of portal delivery.
type TenantService struct {
	ID               uuid.UUID              `json:"id"` // service_id
	Name             string                 `json:"name"`
	MFEURL           string                 `json:"mfe_url"`
	DeploymentName   string                 `json:"deployment_name"`
	IsEnabled        bool                   `json:"is_enabled"`
	RequiresBusiness bool                   `json:"requires_business"`
	Business         *TenantServiceBusiness `json:"business,omitempty"`
}

type ServiceRepository interface {
	Create(ctx context.Context, input CreateServiceInput) (*Service, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Service, error)
	List(ctx context.Context, onlyActive bool) ([]*Service, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateServiceInput) (*Service, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
