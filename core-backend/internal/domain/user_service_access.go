package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// PlatformTenantID and ManagerServiceID identify the seeded "Platform"
// tenant and its private "Manager" (core-admin) service (see
// internal/seed/seed.go). A user_service_access grant on a service_instance
// under this tenant+service combination is treated as "internal staff"
// access — the grant-table-backed equivalent of the old
// claims.Role == "superadmin" check. Shared by internal/authz and
// internal/middleware so both can apply the same rule without importing
// each other.
var (
	PlatformTenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	ManagerServiceID = uuid.MustParse("00000000-0000-0000-0000-000000000010")
)

// ServiceAccessGrant is a user_service_access row enriched with
// human-readable names for the granted service, instance, and role — the
// shape returned by ListGrantsByUser for display in the admin UI.
type ServiceAccessGrant struct {
	ID                  uuid.UUID `json:"id"`
	UserID              uuid.UUID `json:"user_id"`
	ServiceInstanceID   uuid.UUID `json:"service_instance_id"`
	ServiceInstanceName string    `json:"service_instance_name"`
	ServiceID           uuid.UUID `json:"service_id"`
	ServiceName         string    `json:"service_name"`
	RoleID              uuid.UUID `json:"role_id"`
	RoleName            string    `json:"role_name"`
	CreatedAt           time.Time `json:"created_at"`
}

// UserServiceAccessRepository backs the grant-based authorization checks in
// authz.CanAccessTenant and middleware.RequireInternalAccess, and the grant
// CRUD used to restrict individual business users to specific services (see
// users.restrict_services). A "grant" is a row in user_service_access: a
// user granted a role on a specific service_instance, which belongs to a
// tenant_services adhesion (tenant + service).
type UserServiceAccessRepository interface {
	// HasTenantGrant reports whether userID holds a grant on any
	// service_instance belonging to tenantID (joined through
	// service_instances -> tenant_services).
	HasTenantGrant(ctx context.Context, userID, tenantID uuid.UUID) (bool, error)

	// HasServiceGrant reports whether userID holds a grant on any
	// service_instance belonging to the given tenant+service combination.
	HasServiceGrant(ctx context.Context, userID, tenantID, serviceID uuid.UUID) (bool, error)

	// CreateGrant inserts a user_service_access row granting userID the role
	// roleID on serviceInstanceID. The DB trigger
	// enforce_role_service_match (migration 031) validates that roleID
	// belongs to the same service as serviceInstanceID — callers must not
	// reimplement that check in Go, only translate the resulting Postgres
	// error into an HTTP response.
	CreateGrant(ctx context.Context, userID, serviceInstanceID, roleID uuid.UUID) (*ServiceAccessGrant, error)

	// ListGrantsByUser returns every grant held by userID, enriched with
	// readable service/instance/role names for display.
	ListGrantsByUser(ctx context.Context, userID uuid.UUID) ([]*ServiceAccessGrant, error)

	// DeleteGrant removes grant grantID, scoped to userID so a caller can't
	// delete another user's grant by guessing an id.
	DeleteGrant(ctx context.Context, userID, grantID uuid.UUID) error
}
