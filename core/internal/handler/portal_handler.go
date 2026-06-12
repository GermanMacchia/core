package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/tenant-core/internal/repository"
	"github.com/tu-org/tenant-core/pkg/response"
)

type PortalHandler struct {
	portals *repository.PortalRepo
	tenants *repository.TenantRepo
}

func NewPortalHandler(portals *repository.PortalRepo, tenants *repository.TenantRepo) *PortalHandler {
	return &PortalHandler{portals: portals, tenants: tenants}
}

// PublicConfig returns the portal bootstrap payload for the Shell (no auth required).
//
//	GET /api/v1/public/portals/{portal_id}
//	Header: X-Tenant-ID: <tenant_uuid>
func (h *PortalHandler) PublicConfig(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}

	tenantIDStr := r.Header.Get("X-Tenant-ID")
	if tenantIDStr == "" {
		response.BadRequest(w, "X-Tenant-ID header required")
		return
	}
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		response.BadRequest(w, "invalid X-Tenant-ID")
		return
	}

	tenant, err := h.tenants.GetByID(r.Context(), tenantID)
	if err != nil {
		response.NotFound(w)
		return
	}

	portal, err := h.portals.GetByID(r.Context(), portalID, tenantID)
	if err != nil {
		response.NotFound(w)
		return
	}

	services, err := h.portals.GetServices(r.Context(), portalID)
	if err != nil {
		response.InternalError(w)
		return
	}

	type tenantOut struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	type portalOut struct {
		ID     string         `json:"id"`
		Name   string         `json:"name"`
		Config map[string]any `json:"config,omitempty"`
	}
	type serviceOut struct {
		Slug         string   `json:"slug"`
		MFEURL       string   `json:"mfe_url"`
		AuthAPIURL   string   `json:"auth_api_url,omitempty"`
		Public       bool     `json:"public"`
		AllowedRoles []string `json:"allowed_roles,omitempty"`
		SortOrder    int      `json:"sort_order"`
	}

	svcList := make([]serviceOut, 0, len(services))
	for _, svc := range services {
		out := serviceOut{
			Slug:      svc.Slug,
			MFEURL:    svc.MFEURL,
			SortOrder: svc.SortOrder,
		}
		if v, ok := svc.Config["auth_api_url"].(string); ok {
			out.AuthAPIURL = v
		}
		if v, ok := svc.Config["public"].(bool); ok {
			out.Public = v
		}
		if v, ok := svc.Config["allowed_roles"].([]any); ok {
			roles := make([]string, 0, len(v))
			for _, r := range v {
				if s, ok := r.(string); ok {
					roles = append(roles, s)
				}
			}
			out.AllowedRoles = roles
		}
		svcList = append(svcList, out)
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant": tenantOut{
			ID:   tenant.ID.String(),
			Name: tenant.Name,
		},
		"portal": portalOut{
			ID:     portal.ID.String(),
			Name:   portal.Name,
			Config: portal.Config,
		},
		"services": svcList,
	})
}
