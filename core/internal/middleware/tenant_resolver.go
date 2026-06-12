package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
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
	if claims := ClaimsFromCtx(r.Context()); claims != nil && claims.TenantID != "" {
		if id, err := uuid.Parse(claims.TenantID); err == nil {
			return m.getTenantByID(r.Context(), id)
		}
	}

	// 2. From X-Tenant-ID UUID header
	if idStr := r.Header.Get("X-Tenant-ID"); idStr != "" {
		if id, err := uuid.Parse(idStr); err == nil {
			return m.getTenantByID(r.Context(), id)
		}
	}

	// 3. From Host header (domain-based resolution)
	host := r.Host
	if idx := strings.Index(host, ":"); idx > 0 {
		host = host[:idx]
	}
	if host != "" && host != "localhost" {
		return m.getTenantByDomain(r.Context(), host)
	}

	return nil, nil
}

func (m *TenantResolver) getTenantByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	key := cache.TenantKey(id.String())
	var tenant domain.Tenant
	if err := m.cache.Get(ctx, key, &tenant); err == nil {
		return &tenant, nil
	}
	t, err := m.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	_ = m.cache.Set(ctx, key, t, cache.TTLTenantConfig)
	return t, nil
}

func (m *TenantResolver) getTenantByDomain(ctx context.Context, host string) (*domain.Tenant, error) {
	key := cache.TenantDomainKey(host)
	var tenant domain.Tenant
	if err := m.cache.Get(ctx, key, &tenant); err == nil {
		return &tenant, nil
	}
	t, err := m.repo.GetByDomain(ctx, host)
	if err != nil {
		return nil, err
	}
	_ = m.cache.Set(ctx, key, t, cache.TTLTenantConfig)
	_ = m.cache.Set(ctx, cache.TenantKey(t.ID.String()), t, cache.TTLTenantConfig)
	return t, nil
}

func TenantFromCtx(ctx context.Context) *domain.Tenant {
	t, _ := ctx.Value(CtxKeyTenant).(*domain.Tenant)
	return t
}

func InvalidateTenantCache(ctx context.Context, c *cache.Cache, tenantID string, tenantDomain string) {
	_ = c.Del(ctx, cache.TenantKey(tenantID))
	if tenantDomain != "" {
		_ = c.Del(ctx, cache.TenantDomainKey(tenantDomain))
	}
}
