package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ServiceInstanceStatus string

const (
	ServiceInstanceStatusActive   ServiceInstanceStatus = "active"
	ServiceInstanceStatusArchived ServiceInstanceStatus = "archived"
)

// ServiceInstance is a "negocio": one concrete, independently named/slugged
// operating instance of a service a tenant has adhered to via tenant_services
// (see migrations/025_create_service_instances.sql).
type ServiceInstance struct {
	ID              uuid.UUID             `json:"id"`
	TenantServiceID uuid.UUID             `json:"tenant_service_id"`
	Name            string                `json:"name"`
	Slug            string                `json:"slug"`
	Config          JSONMap               `json:"config"`
	Status          ServiceInstanceStatus `json:"status"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
}

// TenantServiceInstance is the "negocio" instance nested inside a
// TenantService response — a lightweight view of ServiceInstance scoped to
// the tenant/service pair it belongs to.
type TenantServiceInstance struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Slug   string    `json:"slug"`
	Config JSONMap   `json:"config"`
}

// ServiceInstanceRepository backs read access to service_instances rows.
type ServiceInstanceRepository interface {
	// ListByService returns every service_instances row belonging to a
	// tenant_services adhesion for the service identified by
	// serviceIdentifier (a services.id UUID, or a services.name otherwise —
	// services.slug was dropped in migrations/014).
	ListByService(ctx context.Context, serviceIdentifier string) ([]*ServiceInstance, error)
}
