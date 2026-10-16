// Package authz holds authorization checks shared across handlers.
//
// CanAccessPortal is a claims-based stopgap that closes a
// missing-ownership-check gap in portal_handler.go (platform-wide
// superadmin, or same-tenant caller via JWT claims).
//
// CanAccessTenant is the real grant-table-backed check: it queries
// user_service_access (joined through businesses -> tenant_services)
// instead of trusting a claims.Role string.
package authz

import (
	"context"

	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/middleware"
)

// CanAccessPortal reports whether the caller identified by the request
// context's JWT claims may act on the portal identified by portalID.
//
// It resolves the portal's owning tenant (portal_id alone doesn't carry that
// information the way tenant-scoped routes do) and applies the same
// claims-based rule tenant_handler.go used to apply via its now-removed
// allowTenantAccess: platform-wide superadmins pass, and callers whose own
// tenant matches the portal's tenant pass. Everyone else is denied. This can
// only reduce over-permissive access relative to today's zero-check behavior.
func CanAccessPortal(ctx context.Context, portals domain.PortalRepository, portalID uuid.UUID) bool {
	claims := middleware.ClaimsFromCtx(ctx)
	if claims == nil {
		return false
	}
	if claims.Role == "superadmin" {
		return true
	}

	tenantID, err := portals.GetTenantIDByPortalID(ctx, portalID)
	if err != nil {
		return false
	}
	return claims.TenantID == tenantID.String()
}

// CanAccessTenant reports whether userID may act on tenantID's resources.
// This is the grant-table-backed replacement for tenant_handler.go's former
// allowTenantAccess claims check: the caller passes so long as they hold a
// user_service_access grant on some business under tenantID, or a
// grant on the Manager/core-admin business (Platform tenant, Manager
// service) — the grant-based equivalent of "platform-wide superadmin".
// Unlike CanAccessPortal, this does not read claims.Role at all.
func CanAccessTenant(ctx context.Context, access domain.UserServiceAccessRepository, userID, tenantID uuid.UUID) bool {
	if ok, err := access.HasTenantGrant(ctx, userID, tenantID); err == nil && ok {
		return true
	}
	ok, err := access.HasServiceGrant(ctx, userID, domain.PlatformTenantID, domain.ManagerServiceID)
	return err == nil && ok
}
