package domain

import (
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
