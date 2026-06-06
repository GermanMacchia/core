package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/tu-org/tenant-core/internal/cache"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/repository"
	"github.com/tu-org/tenant-core/pkg/response"
)

const CtxKeyTenant contextKey = "tenant"

type TenantResolver struct {
	repo  *repository.TenantRepo
	cache *cache.Cache
}

func NewTenantResolver(repo *repository.TenantRepo, c *cache.Cache) *TenantResolver {
	return &TenantResolver{repo: repo, cache: c}
}

func (m *TenantResolver) Resolve(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant, err := m.resolveTenant(r)
		if err != nil || tenant == nil {
			response.Error(w, http.StatusUnprocessableEntity, "could not resolve tenant")
			return
		}

		if tenant.Status != domain.TenantStatusActive && tenant.Status != domain.TenantStatusTrial {
			response.Error(w, http.StatusForbidden, "tenant is not active")
			return
		}

		ctx := context.WithValue(r.Context(), CtxKeyTenant, tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *TenantResolver) resolveTenant(r *http.Request) (*domain.Tenant, error) {
	// 1. From JWT claims (already set by JWTMiddleware)
	if claims := ClaimsFromCtx(r.Context()); claims != nil && claims.Tenant != "" {
		return m.getTenantBySlug(r.Context(), claims.Tenant)
	}

	// 2. From X-Tenant-Slug header
	if slug := r.Header.Get("X-Tenant-Slug"); slug != "" {
		return m.getTenantBySlug(r.Context(), slug)
	}

	// 3. From subdomain
	host := r.Host
	if idx := strings.Index(host, "."); idx > 0 {
		slug := host[:idx]
		if slug != "www" && slug != "api" {
			return m.getTenantBySlug(r.Context(), slug)
		}
	}

	return nil, nil
}

func (m *TenantResolver) getTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	var tenant domain.Tenant
	key := cache.TenantKey(slug)

	if err := m.cache.Get(ctx, key, &tenant); err == nil {
		return &tenant, nil
	}

	t, err := m.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	_ = m.cache.Set(ctx, key, t, cache.TTLTenantConfig)
	return t, nil
}

func TenantFromCtx(ctx context.Context) *domain.Tenant {
	t, _ := ctx.Value(CtxKeyTenant).(*domain.Tenant)
	return t
}

func InvalidateTenantCache(ctx context.Context, c *cache.Cache, slug string, ttl time.Duration) {
	_ = c.Del(ctx, cache.TenantKey(slug))
}
