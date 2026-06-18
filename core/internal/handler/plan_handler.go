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

type PlanHandler struct {
	repo *repository.PlanRepo
}

func NewPlanHandler(repo *repository.PlanRepo) *PlanHandler {
	return &PlanHandler{repo: repo}
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	plans, err := h.repo.List(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, plans)
}

func (h *PlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	plan, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.JSON(w, http.StatusOK, plan)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreatePlanInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Name == "" {
		response.BadRequest(w, "name is required")
		return
	}
	plan, err := h.repo.Create(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, plan)
}

func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	var input domain.UpdatePlanInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	plan, err := h.repo.Update(r.Context(), id, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, plan)
}

func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *PlanHandler) ListServicePricing(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	pricing, err := h.repo.ListServicePricing(r.Context(), id)
	if err != nil {
		response.InternalError(w)
		return
	}
	if pricing == nil {
		pricing = []*domain.PlanServicePricing{}
	}
	response.JSON(w, http.StatusOK, pricing)
}

func (h *PlanHandler) SetServicePricing(w http.ResponseWriter, r *http.Request) {
	planID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	var body struct {
		Price   float64 `json:"price"`
		IsIncluded bool    `json:"is_included"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	pricing, err := h.repo.SetServicePricing(r.Context(), planID, domain.SetServicePricingInput{
		ServiceID:  serviceID,
		Price:   body.Price,
		IsIncluded: body.IsIncluded,
	})
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, pricing)
}

func (h *PlanHandler) RemoveServicePricing(w http.ResponseWriter, r *http.Request) {
	planID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid plan id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service id")
		return
	}
	if err := h.repo.RemoveServicePricing(r.Context(), planID, serviceID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
