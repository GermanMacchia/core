package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/middleware"
	"github.com/tu-org/core-backend/internal/repository"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type TenantHandler struct {
	tenants *service.TenantService
	portals *repository.PortalRepo
}

func NewTenantHandler(tenants *service.TenantService, portals *repository.PortalRepo) *TenantHandler {
	return &TenantHandler{tenants: tenants, portals: portals}
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
	if input.Name == "" {
		response.BadRequest(w, "name is required")
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
	if !allowTenantAccess(r, id) {
		middleware.Forbidden(w)
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
	if !allowTenantAccess(r, id) {
		middleware.Forbidden(w)
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

// GetServices lists all enabled services for a tenant across all their portals.
func (h *TenantHandler) GetServices(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	if !allowTenantAccess(r, id) {
		middleware.Forbidden(w)
		return
	}

	svcs, err := h.portals.ListServicesByTenant(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svcs)
}

func (h *TenantHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	if !allowTenantAccess(r, id) {
		middleware.Forbidden(w)
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
	if !allowTenantAccess(r, tenantID) {
		middleware.Forbidden(w)
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

func (h *TenantHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	if !allowTenantAccess(r, tenantID) {
		middleware.Forbidden(w)
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "uid"))
	if err != nil {
		response.BadRequest(w, "invalid user id")
		return
	}

	var input domain.UpdateUserInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	user, err := h.tenants.UpdateUser(r.Context(), userID, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, user)
}

func (h *TenantHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	if !allowTenantAccess(r, tenantID) {
		middleware.Forbidden(w)
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "uid"))
	if err != nil {
		response.BadRequest(w, "invalid user id")
		return
	}

	if err := h.tenants.DeleteUser(r.Context(), userID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PublicConfig returns the tenant bootstrap config for the Shell before login.
// Tenant is resolved from X-Tenant-ID header or domain (no JWT required).
func (h *TenantHandler) PublicConfig(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.TenantFromCtx(r.Context())
	if tenant == nil {
		response.NotFound(w)
		return
	}

	svcs, err := h.portals.ListServicesByTenant(r.Context(), tenant.ID)
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
		ID           string `json:"id"`
		Name         string `json:"name"`
		LogoURL      string `json:"logo_url,omitempty"`
		PrimaryColor string `json:"primary_color,omitempty"`
	}

	meta := tenantMeta{ID: tenant.ID.String(), Name: tenant.Name}
	if v, ok := tenant.Config["logo_url"].(string); ok {
		meta.LogoURL = v
	}
	if v, ok := tenant.Config["primary_color"].(string); ok {
		meta.PrimaryColor = v
	}

	mfes := make([]mfeEntry, 0, len(svcs))
	for _, svc := range svcs {
		isPublic, _ := svc.Config["public"].(bool)
		mfes = append(mfes, mfeEntry{
			Slug:   svc.Slug,
			MFEURL: svc.MFEURL,
			Public: isPublic,
		})
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant": meta,
		"mfes":   mfes,
	})
}

// Context returns the full tenant context for the Shell after login.
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

	svcs, err := h.portals.ListServicesByTenant(r.Context(), tenant.ID)
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
		Name string `json:"name"`
	}

	svcItems := make([]serviceItem, 0, len(svcs))
	for _, svc := range svcs {
		svcItems = append(svcItems, serviceItem{Slug: svc.Slug, MFEURL: svc.MFEURL})
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"tenant": tenantCtx{
			ID:   tenant.ID.String(),
			Name: tenant.Name,
		},
		"services": svcItems,
		"user": userCtx{
			ID:   claims.Subject,
			Role: claims.Role,
		},
	})
}

func allowTenantAccess(r *http.Request, tenantID uuid.UUID) bool {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		return false
	}
	return claims.Role == "superadmin" || claims.TenantID == tenantID.String()
}

func (h *TenantHandler) PublicListByService(w http.ResponseWriter, r *http.Request) {
	serviceIdentifier := chi.URLParam(r, "service_identifier")
	if serviceIdentifier == "" {
		response.BadRequest(w, "service_identifier is required")
		return
	}

	tenants, err := h.tenants.ListByService(r.Context(), serviceIdentifier)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, tenants)
}

