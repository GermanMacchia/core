package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/tu-org/core-backend/internal/authz"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/middleware"
	"github.com/tu-org/core-backend/internal/repository"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type TenantHandler struct {
	tenants        *service.TenantService
	portals        *repository.PortalRepo
	access         *repository.UserServiceAccessRepo
	instances      *repository.ServiceInstanceRepo
	tenantServices *repository.TenantServiceRepo
}

func NewTenantHandler(tenants *service.TenantService, portals *repository.PortalRepo, access *repository.UserServiceAccessRepo, instances *repository.ServiceInstanceRepo, tenantServices *repository.TenantServiceRepo) *TenantHandler {
	return &TenantHandler{tenants: tenants, portals: portals, access: access, instances: instances, tenantServices: tenantServices}
}

// callerUserID extracts the authenticated caller's user id from the request
// context's JWT claims. The JWT still carries the old claims shape (subject
// = user id) at this point in the rollout; only WHAT is checked against it
// (the grant table, via authz.CanAccessTenant) is changing here, not how the
// caller identity itself is obtained.
func callerUserID(r *http.Request) (uuid.UUID, bool) {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, id) {
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, id) {
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, id) {
		middleware.Forbidden(w)
		return
	}

	svcs, err := h.tenantServices.ListByTenant(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svcs)
}

// AssignService adheres a service directly to a tenant, independent of portal
// delivery.
//
//	POST /api/v1/tenants/{id}/services
func (h *TenantHandler) AssignService(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
		middleware.Forbidden(w)
		return
	}

	var body struct {
		ServiceID uuid.UUID `json:"service_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	ts, err := h.tenantServices.AssignService(r.Context(), tenantID, body.ServiceID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, ts)
}

// UnassignService removes a tenant's direct adhesion to a service.
//
//	DELETE /api/v1/tenants/{id}/services/{service_id}
func (h *TenantHandler) UnassignService(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
		middleware.Forbidden(w)
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service_id")
		return
	}

	if err := h.tenantServices.UnassignService(r.Context(), tenantID, serviceID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateInstance partially updates the service_instances ("negocio") row
// backing a tenant's adhesion to a service.
//
//	PATCH /api/v1/tenants/{id}/services/{service_id}/instance
func (h *TenantHandler) UpdateInstance(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
		middleware.Forbidden(w)
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service_id")
		return
	}

	var body struct {
		Name   *string        `json:"name"`
		Config domain.JSONMap `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	inst, err := h.tenantServices.UpdateInstance(r.Context(), tenantID, serviceID, body.Name, body.Config)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.Error(w, http.StatusNotFound, "no service instance found for this tenant/service")
			return
		}
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, inst)
}

func (h *TenantHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid tenant id")
		return
	}
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, id) {
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
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
	callerID, ok := callerUserID(r)
	if !ok || !authz.CanAccessTenant(r.Context(), h.access, callerID, tenantID) {
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
		Slug    string `json:"slug"`
		MFEURL  string `json:"mfe_url"`
		LogoURL string `json:"logo_url,omitempty"`
		Public  bool   `json:"public"`
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
		logoURL, _ := firstString("logo_url", tenant.Config, svc.Config)
		mfes = append(mfes, mfeEntry{
			Slug:    svc.Slug,
			MFEURL:  svc.MFEURL,
			LogoURL: logoURL,
			Public:  isPublic,
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

// PublicListInstancesByService returns the service_instances ("negocios")
// adhered to the service identified by {service_identifier} (a services.id
// UUID or a services.name — services.slug was dropped in migrations/014).
// This is the portal-independent replacement for
// PublicListByService that booking-backend's SyncTenants repoints at (see
// plan §2/§5): each item's ID now opaquely holds a service_instances.id
// instead of a tenants.id. The old .../tenants endpoint stays live alongside
// this one until booking-backend fully migrates.
func (h *TenantHandler) PublicListInstancesByService(w http.ResponseWriter, r *http.Request) {
	serviceIdentifier := chi.URLParam(r, "service_identifier")
	if serviceIdentifier == "" {
		response.BadRequest(w, "service_identifier is required")
		return
	}

	instances, err := h.instances.ListByService(r.Context(), serviceIdentifier)
	if err != nil {
		response.InternalError(w)
		return
	}

	type instanceItem struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Slug   string `json:"slug"`
		Status string `json:"status"`
	}

	items := make([]instanceItem, 0, len(instances))
	for _, inst := range instances {
		items = append(items, instanceItem{
			ID:     inst.ID.String(),
			Name:   inst.Name,
			Slug:   inst.Slug,
			Status: string(inst.Status),
		})
	}
	response.JSON(w, http.StatusOK, items)
}

