package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Portal struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Domain      *string   `json:"domain,omitempty"`
	Description *string   `json:"description,omitempty"`
	Config      JSONMap   `json:"config"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PortalService struct {
	ServiceID uuid.UUID `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	MFEURL    string    `json:"mfe_url"`
	Config    JSONMap   `json:"config"`
	SortOrder int       `json:"sort_order"`
}

type CreatePortalInput struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Domain      *string   `json:"domain,omitempty"`
	Description *string   `json:"description,omitempty"`
	Config      JSONMap   `json:"config"`
}

type UpdatePortalInput struct {
	Name        *string `json:"name,omitempty"`
	Domain      *string `json:"domain,omitempty"`
	Description *string `json:"description,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
	Config      JSONMap `json:"config,omitempty"`
}

type AssignPortalServiceInput struct {
	PortalID  uuid.UUID  `json:"portal_id"`
	ServiceID uuid.UUID  `json:"service_id"`
	Slug      string     `json:"slug"`
	SortOrder int        `json:"sort_order"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type UpdatePortalServiceInput struct {
	Slug           *string    `json:"slug,omitempty"`
	SortOrder      *int       `json:"sort_order,omitempty"`
	ConfigOverride JSONMap    `json:"config_override,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

type PortalRepository interface {
	GetByID(ctx context.Context, portalID, tenantID uuid.UUID) (*Portal, error)
	ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]*Portal, error)
	Create(ctx context.Context, input CreatePortalInput) (*Portal, error)
	Update(ctx context.Context, portalID uuid.UUID, input UpdatePortalInput) (*Portal, error)
	AssignService(ctx context.Context, input AssignPortalServiceInput) (*PortalService, error)
	UpdatePortalService(ctx context.Context, portalID, serviceID uuid.UUID, input UpdatePortalServiceInput) (*PortalService, error)
	UnassignService(ctx context.Context, portalID, serviceID uuid.UUID) error
	GetServices(ctx context.Context, portalID uuid.UUID) ([]*PortalService, error)
	ListServicesByTenant(ctx context.Context, tenantID uuid.UUID) ([]*PortalService, error)
}
