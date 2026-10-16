package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type DeploymentHandler struct {
	svc *service.DeploymentSvc
}

func NewDeploymentHandler(svc *service.DeploymentSvc) *DeploymentHandler {
	return &DeploymentHandler{svc: svc}
}

// GET /api/v1/deployments[?all=true]
func (h *DeploymentHandler) List(w http.ResponseWriter, r *http.Request) {
	onlyActive := r.URL.Query().Get("all") != "true"
	deployments, err := h.svc.List(r.Context(), onlyActive)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, deployments)
}

// POST /api/v1/deployments
func (h *DeploymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateDeploymentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.URL = strings.TrimSpace(input.URL)
	if input.Name == "" || input.URL == "" {
		response.BadRequest(w, "name and url are required")
		return
	}
	if input.Version == "" {
		input.Version = "1.0.0"
	}

	d, err := h.svc.Create(r.Context(), input)
	if err != nil {
		writeDeploymentWriteError(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

// GET /api/v1/deployments/{id}
func (h *DeploymentHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid deployment id")
		return
	}
	d, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

// PATCH /api/v1/deployments/{id}
func (h *DeploymentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid deployment id")
		return
	}
	var input domain.UpdateDeploymentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Name != nil && strings.TrimSpace(*input.Name) == "" {
		response.BadRequest(w, "name cannot be empty")
		return
	}
	if input.URL != nil && strings.TrimSpace(*input.URL) == "" {
		response.BadRequest(w, "url cannot be empty")
		return
	}

	d, err := h.svc.Update(r.Context(), id, input)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(w)
			return
		}
		writeDeploymentWriteError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

// Delete hard-deletes a deployment. Fails with 409 while any service still
// rests on it (see domain.ErrDeploymentInUse).
//
//	DELETE /api/v1/deployments/{id}
func (h *DeploymentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid deployment id")
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrDeploymentInUse) {
			response.Conflict(w, "deployment is in use by one or more services; reassign or delete them first")
			return
		}
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// writeDeploymentWriteError maps a create/update failure to a response:
// SQLSTATE 23505 (name UNIQUE) is a 409, anything else a 500.
func writeDeploymentWriteError(w http.ResponseWriter, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		response.Conflict(w, "a deployment with that name already exists")
		return
	}
	response.InternalError(w)
}
