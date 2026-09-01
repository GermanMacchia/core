package middleware

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
)

// RequireInternalAccess replaces RequireRole("superadmin") for
// platform-operator-only routes. It grants access to callers holding a
// user_service_access grant on the Manager/core-admin service instance
// (domain.PlatformTenantID, domain.ManagerServiceID) — i.e. "is internal
// staff" — the grant-table-backed equivalent of the old
// claims.Role == "superadmin" check. The JWT still carries the old claims
// shape at this point in the rollout, so the caller's user id is still read
// from claims.Subject; only what is checked against it changes.
func RequireInternalAccess(access domain.UserServiceAccessRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromCtx(r.Context())
			if claims == nil {
				Forbidden(w)
				return
			}
			userID, err := uuid.Parse(claims.Subject)
			if err != nil {
				Forbidden(w)
				return
			}

			ok, err := access.HasServiceGrant(r.Context(), userID, domain.PlatformTenantID, domain.ManagerServiceID)
			if err != nil || !ok {
				Forbidden(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
