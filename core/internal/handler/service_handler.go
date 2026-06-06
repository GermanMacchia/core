package handler

import (
	"encoding/json"
	"net/http"

	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/service"
	"github.com/tu-org/tenant-core/pkg/response"
)

type ServiceHandler struct {
	svc *service.ServiceSvc
}

func NewServiceHandler(svc *service.ServiceSvc) *ServiceHandler {
	return &ServiceHandler{svc: svc}
}

func (h *ServiceHandler) List(w http.ResponseWriter, r *http.Request) {
	svcs, err := h.svc.List(r.Context(), true)
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
	if input.Name == "" || input.Slug == "" || input.MFEURL == "" {
		response.BadRequest(w, "name, slug and mfe_url are required")
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
