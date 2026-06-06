package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/middleware"
	"github.com/tu-org/tenant-core/internal/service"
	"github.com/tu-org/tenant-core/pkg/response"
)

type TenantHandler struct {
	tenants  *service.TenantService
	services *service.ServiceSvc
}

func NewTenantHandler(tenants *service.TenantService, services *service.ServiceSvc) *TenantHandler {
	return &TenantHandler{tenants: tenants, services: services}
}

func (h *TenantHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 20
	}

	tenants, err := h.tenants.List(r.Context(), limit, offset)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSONList(w, http.StatusOK, tenants, response.Meta{Total: len(tenants), Limit: limit, Offset: offset})
}

func (h *TenantHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Slug == "" || input.Name == "" {
		response.BadRequest(w, "slug and name are required")
		return
	}

	tenant, err := h.tenants.Create(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, tenant)
}

func (h *TenantHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	tenant, err := h.tenants.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.JSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	var input domain.UpdateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	tenant, err := h.tenants.Update(r.Context(), id, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, tenant)
}

func (h *TenantHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	if err := h.tenants.Delete(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TenantHandler) GetServices(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	svcs, err := h.services.GetTenantServices(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svcs)
}

func (h *TenantHandler) EnableService(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	var body struct {
		ServiceID      uuid.UUID      `json:"service_id"`
		ConfigOverride domain.JSONMap `json:"config_override"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	ts, err := h.services.EnableForTenant(r.Context(), domain.EnableServiceInput{
		TenantID:       tenantID,
		ServiceID:      body.ServiceID,
		ConfigOverride: body.ConfigOverride,
	})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, ts)
}

func (h *TenantHandler) DisableService(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "sid"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}

	if err := h.services.DisableForTenant(r.Context(), tenantID, serviceID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TenantHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	users, err := h.tenants.GetUsers(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, users)
}

func (h *TenantHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}

	var input domain.CreateUserInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Email == "" || input.Password == "" {
		response.BadRequest(w, "email and password are required")
		return
	}

	input.TenantID = tenantID
	user, err := h.tenants.CreateUser(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, user)
}

// PublicConfig returns the tenant bootstrap config for the Shell before login.
// Tenant is resolved from subdomain or X-Tenant-Slug header (no JWT required).
func (h *TenantHandler) PublicConfig(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.TenantFromCtx(r.Context())
	if tenant == nil {
		response.NotFound(w)
		return
	}

	tenantSvcs, err := h.services.GetTenantServices(r.Context(), tenant.ID)
	if err != nil {
		response.InternalError(w)
		return
	}

	type mfeEntry struct {
		Slug   string `json:"slug"`
		MFEURL string `json:"mfe_url"`
		Public bool   `json:"public"`
	}
	type tenantMeta struct {
		Slug         string `json:"slug"`
		Name         string `json:"name"`
		LogoURL      string `json:"logo_url,omitempty"`
		PrimaryColor string `json:"primary_color,omitempty"`
	}

	meta := tenantMeta{Slug: tenant.Slug, Name: tenant.Name}
	if v, ok := tenant.Config["logo_url"].(string); ok {
		meta.LogoURL = v
	}
	if v, ok := tenant.Config["primary_color"].(string); ok {
		meta.PrimaryColor = v
	}

	var authMFEURL, authAPIURL string
	mfes := make([]mfeEntry, 0, len(tenantSvcs))
	for _, ts := range tenantSvcs {
		if ts.Service == nil || !ts.IsEnabled {
			continue
		}
		if ts.Service.Slug == "auth" {
			authMFEURL = ts.Service.MFEURL
			if ts.Service.APIURL != nil {
				authAPIURL = *ts.Service.APIURL
			}
			continue
		}
		isPublic, _ := ts.Service.Config["public"].(bool)
		mfes = append(mfes, mfeEntry{
			Slug:   ts.Service.Slug,
			MFEURL: ts.Service.MFEURL,
			Public: isPublic,
		})
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant":       meta,
		"auth_mfe_url": authMFEURL,
		"auth_api_url": authAPIURL,
		"mfes":         mfes,
	})
}

// Context returns the full tenant context for the Shell
func (h *TenantHandler) Context(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}

	tenant := middleware.TenantFromCtx(r.Context())
	if tenant == nil {
		response.NotFound(w)
		return
	}

	tenantSvcs, err := h.services.GetTenantServices(r.Context(), tenant.ID)
	if err != nil {
		response.InternalError(w)
		return
	}

	type serviceItem struct {
		Slug   string `json:"slug"`
		MFEURL string `json:"mfe_url"`
	}
	type userCtx struct {
		ID   string `json:"id"`
		Role string `json:"role"`
	}
	type tenantCtx struct {
		ID   string `json:"id"`
		Slug string `json:"slug"`
		Name string `json:"name"`
		Plan string `json:"plan"`
	}

	svcItems := make([]serviceItem, 0, len(tenantSvcs))
	for _, ts := range tenantSvcs {
		if ts.Service != nil {
			svcItems = append(svcItems, serviceItem{Slug: ts.Service.Slug, MFEURL: ts.Service.MFEURL})
		}
	}

	planName := ""
	if tenant.Plan != nil {
		planName = tenant.Plan.Name
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant": tenantCtx{
			ID:   tenant.ID.String(),
			Slug: tenant.Slug,
			Name: tenant.Name,
			Plan: planName,
		},
		"services": svcItems,
		"user": userCtx{
			ID:   claims.Subject,
			Role: claims.Role,
		},
	})
}
