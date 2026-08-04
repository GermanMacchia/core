package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type ServiceHandler struct {
	svc *service.ServiceSvc
}

func NewServiceHandler(svc *service.ServiceSvc) *ServiceHandler {
	return &ServiceHandler{svc: svc}
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
	if input.Name == "" || input.MFEURL == "" {
		response.BadRequest(w, "name and mfe_url are required")
		return
	}
	if input.Version == "" {
		input.Version = "1.0.0"
	}

	svc, err := h.svc.Create(r.Context(), input)
	if err != nil {
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
	svc, err := h.svc.Update(r.Context(), id, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, svc)
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
