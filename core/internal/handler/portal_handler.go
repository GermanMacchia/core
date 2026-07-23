package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/tenant-core/internal/domain"
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
		ID     string `json:"id"`
		Name   string `json:"name"`
		Status string `json:"status"`
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
			ID:     tenant.ID.String(),
			Name:   tenant.Name,
			Status: string(tenant.Status),
		},
		"portal": portalOut{
			ID:     portal.ID.String(),
			Name:   portal.Name,
			Config: portal.Config,
		},
		"services": svcList,
	})
}

// ListByTenant returns all active portals for a tenant.
//
//	GET /api/v1/tenants/{id}/portals
func (h *PortalHandler) ListByTenant(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	portals, err := h.portals.ListByTenantID(r.Context(), tenantID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, portals)
}

// CreatePortal creates a new portal for a tenant.
//
//	POST /api/v1/tenants/{id}/portals
func (h *PortalHandler) CreatePortal(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	var body struct {
		Name        string  `json:"name"`
		Domain      *string `json:"domain,omitempty"`
		Description *string `json:"description,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}

	portal, err := h.portals.Create(r.Context(), domain.CreatePortalInput{
		TenantID:    tenantID,
		Name:        body.Name,
		Domain:      body.Domain,
		Description: body.Description,
		Config:      domain.JSONMap{},
	})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, portal)
}

// UpdatePortal updates name, domain, or description of a portal.
//
//	PATCH /api/v1/portals/{portal_id}
func (h *PortalHandler) UpdatePortal(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}

	var input domain.UpdatePortalInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	portal, err := h.portals.Update(r.Context(), portalID, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, portal)
}

// GetServicesAuth returns the enabled services for a portal (authenticated).
//
//	GET /api/v1/portals/{portal_id}/services
func (h *PortalHandler) GetServicesAuth(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}

	services, err := h.portals.GetServices(r.Context(), portalID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, services)
}

// AssignService adds or re-enables a service on a portal.
//
//	POST /api/v1/portals/{portal_id}/services
func (h *PortalHandler) AssignService(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}

	var body struct {
		ServiceID uuid.UUID `json:"service_id"`
		Slug      string    `json:"slug"`
		SortOrder int       `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if body.Slug == "" {
		response.BadRequest(w, "slug is required")
		return
	}

	ps, err := h.portals.AssignService(r.Context(), domain.AssignPortalServiceInput{
		PortalID:  portalID,
		ServiceID: body.ServiceID,
		Slug:      body.Slug,
		SortOrder: body.SortOrder,
	})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, ps)
}

// UnassignService disables a service on a portal.
//
//	DELETE /api/v1/portals/{portal_id}/services/{service_id}
func (h *PortalHandler) UnassignService(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service_id")
		return
	}

	if err := h.portals.UnassignService(r.Context(), portalID, serviceID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdatePortalService updates fields of an assigned service in a portal.
//
//	PATCH /api/v1/portals/{portal_id}/services/{service_id}
func (h *PortalHandler) UpdatePortalService(w http.ResponseWriter, r *http.Request) {
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service_id")
		return
	}

	var input domain.UpdatePortalServiceInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	ps, err := h.portals.UpdatePortalService(r.Context(), portalID, serviceID, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, ps)
}
