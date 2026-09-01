package domain

import (
	"context"

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

// UserServiceAccessRepository backs the grant-based authorization checks in
// authz.CanAccessTenant and middleware.RequireInternalAccess. A "grant" is a
// row in user_service_access: a user granted a role on a specific
// service_instance, which belongs to a tenant_services adhesion (tenant +
// service).
type UserServiceAccessRepository interface {
	// HasTenantGrant reports whether userID holds a grant on any
	// service_instance belonging to tenantID (joined through
	// service_instances -> tenant_services).
	HasTenantGrant(ctx context.Context, userID, tenantID uuid.UUID) (bool, error)

	// HasServiceGrant reports whether userID holds a grant on any
	// service_instance belonging to the given tenant+service combination.
	HasServiceGrant(ctx context.Context, userID, tenantID, serviceID uuid.UUID) (bool, error)
}
