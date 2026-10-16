package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/repository"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type ServiceHandler struct {
	svc   *service.ServiceSvc
	roles *repository.RoleRepo
}

func NewServiceHandler(svc *service.ServiceSvc, roles *repository.RoleRepo) *ServiceHandler {
	return &ServiceHandler{svc: svc, roles: roles}
}

func (h *ServiceHandler) List(w http.ResponseWriter, r *http.Request) {
	onlyActive := r.URL.Query().Get("all") != "true"
	svcs, err := h.svc.List(r.Context(), onlyActive)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svcs)
}

func (h *ServiceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateServiceInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Name == "" || input.DeploymentID == uuid.Nil {
		response.BadRequest(w, "name and deployment_id are required")
		return
	}
	if input.RequiresBusiness == nil {
		t := true
		input.RequiresBusiness = &t
	}

	svc, err := h.svc.Create(r.Context(), input)
	if err != nil {
		if isUnknownDeployment(err) {
			response.BadRequest(w, "deployment_id does not reference an existing deployment")
			return
		}
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, svc)
}

func (h *ServiceHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	svc, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.JSON(w, http.StatusOK, svc)
}

func (h *ServiceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	var input domain.UpdateServiceInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.DeploymentID != nil && *input.DeploymentID == uuid.Nil {
		response.BadRequest(w, "deployment_id cannot be empty")
		return
	}
	svc, err := h.svc.Update(r.Context(), id, input)
	if err != nil {
		if isUnknownDeployment(err) {
			response.BadRequest(w, "deployment_id does not reference an existing deployment")
			return
		}
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svc)
}

// isUnknownDeployment reports whether err is the services.deployment_id FK
// violation (SQLSTATE 23503), i.e. the caller referenced a deployment that
// does not exist.
func isUnknownDeployment(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func (h *ServiceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListRoles returns the per-service role catalog for serviceID — used to
// populate the role selector when granting a user a user_service_access
// grant scoped to one of that service's businesses.
//
//	GET /api/v1/services/{id}/roles
func (h *ServiceHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	roles, err := h.roles.ListByService(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, roles)
}

// CreateRole creates a new role scoped to serviceID.
//
//	POST /api/v1/services/{id}/roles
func (h *ServiceHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	var input domain.CreateRoleInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	input.ServiceID = serviceID

	role, err := h.roles.Create(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, role)
}

// UpdateRole partially updates a role.
//
//	PATCH /api/v1/roles/{role_id}
func (h *ServiceHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "role_id"))
	if err != nil {
		response.BadRequest(w, "invalid role id")
		return
	}
	var input domain.UpdateRoleInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	role, err := h.roles.Update(r.Context(), id, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, role)
}

// DeleteRole deletes a role. Fails with 409 if the role is still referenced
// by users.role_id or user_service_access.role_id (see domain.ErrRoleInUse).
//
//	DELETE /api/v1/roles/{role_id}
func (h *ServiceHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "role_id"))
	if err != nil {
		response.BadRequest(w, "invalid role id")
		return
	}
	if err := h.roles.Delete(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrRoleInUse) {
			response.Conflict(w, "role is in use and cannot be deleted")
			return
		}
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
