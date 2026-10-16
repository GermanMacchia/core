package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type BusinessStatus string

const (
	BusinessStatusActive   BusinessStatus = "active"
	BusinessStatusArchived BusinessStatus = "archived"
)

// Business is a "negocio": one concrete, independently named/slugged
// operating unit of a service a tenant has adhered to via tenant_services
// (created in migrations/025, renamed to businesses in migrations/038).
type Business struct {
	ID              uuid.UUID      `json:"id"`
	TenantServiceID uuid.UUID      `json:"tenant_service_id"`
	Name            string         `json:"name"`
	Slug            string         `json:"slug"`
	Config          JSONMap        `json:"config"`
	Status          BusinessStatus `json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// TenantServiceBusiness is the "negocio" nested inside a TenantService
// response — a lightweight view of Business scoped to the tenant/service pair
// it belongs to.
type TenantServiceBusiness struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Slug   string    `json:"slug"`
	Config JSONMap   `json:"config"`
}

// BusinessRepository backs read access to businesses rows.
type BusinessRepository interface {
	// ListByService returns every businesses row belonging to a
	// tenant_services adhesion for the service identified by
	// serviceIdentifier (a services.id UUID, or a services.name otherwise —
	// services.slug was dropped in migrations/014).
	ListByService(ctx context.Context, serviceIdentifier string) ([]*Business, error)
}
