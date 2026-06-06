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
//
// The Shell uses this to register its MFEs. Each service entry includes
// per-service auth_mfe_url / auth_api_url extracted from the merged config.
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
		Slug string `json:"slug"`
		Name string `json:"name"`
	}
	type portalOut struct {
		ID     string         `json:"id"`
		Slug   string         `json:"slug"`
		Name   string         `json:"name"`
		Config map[string]any `json:"config,omitempty"`
	}
	type serviceOut struct {
		ID         string  `json:"id"`
		Slug       string  `json:"slug"`
		Name       string  `json:"name"`
		MFEURL     string  `json:"mfe_url"`
		APIURL     *string `json:"api_url,omitempty"`
		AuthMFEURL string  `json:"auth_mfe_url,omitempty"`
		AuthAPIURL string  `json:"auth_api_url,omitempty"`
		Public     bool    `json:"public"`
		SortOrder  int     `json:"sort_order"`
	}

	svcList := make([]serviceOut, 0, len(services))
	for _, svc := range services {
		out := serviceOut{
			ID:        svc.ServiceID.String(),
			Slug:      svc.Slug,
			Name:      svc.Name,
			MFEURL:    svc.MFEURL,
			APIURL:    svc.APIURL,
			SortOrder: svc.SortOrder,
		}
		if v, ok := svc.Config["auth_mfe_url"].(string); ok {
			out.AuthMFEURL = v
		}
		if v, ok := svc.Config["auth_api_url"].(string); ok {
			out.AuthAPIURL = v
		}
		if v, ok := svc.Config["public"].(bool); ok {
			out.Public = v
		}
		svcList = append(svcList, out)
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant": tenantOut{
			ID:   tenant.ID.String(),
			Slug: tenant.Slug,
			Name: tenant.Name,
		},
		"portal": portalOut{
			ID:     portal.ID.String(),
			Slug:   portal.Slug,
			Name:   portal.Name,
			Config: portal.Config,
		},
		"services": svcList,
	})
}
