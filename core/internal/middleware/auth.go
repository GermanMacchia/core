package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/tu-org/tenant-core/internal/cache"
	pkgjwt "github.com/tu-org/tenant-core/pkg/jwt"
	"github.com/tu-org/tenant-core/pkg/response"
)

type contextKey string

const (
	CtxKeyClaims   contextKey = "claims"
	CtxKeyTenantID contextKey = "tenant_id"
	CtxKeyUserID   contextKey = "user_id"
	CtxKeyRole     contextKey = "role"
)

type JWTMiddleware struct {
	manager *pkgjwt.Manager
	cache   *cache.Cache
}

func NewJWTMiddleware(manager *pkgjwt.Manager, c *cache.Cache) *JWTMiddleware {
	return &JWTMiddleware{manager: manager, cache: c}
}

func (m *JWTMiddleware) Verify(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Unauthorized(w)
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := m.manager.Parse(tokenStr)
		if err != nil {
			response.Unauthorized(w)
			return
		}

		// Check token blacklist
		blacklisted, _ := m.cache.Exists(r.Context(), cache.TokenBlacklistKey(claims.ID))
		if blacklisted {
			response.Unauthorized(w)
			return
		}

		ctx := context.WithValue(r.Context(), CtxKeyClaims, claims)
		ctx = context.WithValue(ctx, CtxKeyTenantID, claims.TenantID)
		ctx = context.WithValue(ctx, CtxKeyUserID, claims.Subject)
		ctx = context.WithValue(ctx, CtxKeyRole, claims.Role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ClaimsFromCtx(ctx context.Context) *pkgjwt.Claims {
	c, _ := ctx.Value(CtxKeyClaims).(*pkgjwt.Claims)
	return c
}

func RoleFromCtx(ctx context.Context) string {
	r, _ := ctx.Value(CtxKeyRole).(string)
	return r
}
