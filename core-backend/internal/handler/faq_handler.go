package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/middleware"
	"github.com/tu-org/core-backend/internal/repository"
	"github.com/tu-org/core-backend/internal/service"
	"github.com/tu-org/core-backend/pkg/response"
)

type FaqHandler struct {
	svc  *service.FaqSvc
	repo *repository.FaqRepo
}

func NewFaqHandler(svc *service.FaqSvc, repo *repository.FaqRepo) *FaqHandler {
	return &FaqHandler{svc: svc, repo: repo}
}

// List returns all FAQs for a superadmin, or the FAQs visible to the
// caller's own tenant for any other authenticated user.
//
//	GET /api/v1/faqs
func (h *FaqHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		response.Unauthorized(w)
		return
	}

	if claims.Role == "superadmin" {
		onlyActive := r.URL.Query().Get("active_only") == "true"
		faqs, err := h.svc.List(r.Context(), onlyActive)
		if err != nil {
			response.InternalError(w)
			return
		}
		response.JSON(w, http.StatusOK, faqs)
		return
	}

	tenant := middleware.TenantFromCtx(r.Context())
	if tenant == nil {
		response.NotFound(w)
		return
	}

	faqs, err := h.repo.ListVisibleForTenant(r.Context(), tenant.ID)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, faqs)
}

// Create adds a new FAQ.
//
//	POST /api/v1/faqs
func (h *FaqHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateFaqInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if input.Question == "" || input.Answer == "" {
		response.BadRequest(w, "question and answer are required")
		return
	}

	faq, err := h.svc.Create(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, faq)
}

// Update patches a FAQ's fields.
//
//	PATCH /api/v1/faqs/{id}
func (h *FaqHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}

	var input domain.UpdateFaqInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	faq, err := h.svc.Update(r.Context(), id, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, faq)
}

// Delete soft-deletes a FAQ.
//
//	DELETE /api/v1/faqs/{id}
func (h *FaqHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AssignService links a FAQ to a service.
//
//	POST /api/v1/faqs/{id}/services
func (h *FaqHandler) AssignService(w http.ResponseWriter, r *http.Request) {
	faqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}

	var body struct {
		ServiceID uuid.UUID `json:"service_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if err := h.repo.AssignService(r.Context(), faqID, body.ServiceID); err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"faq_id": faqID, "service_id": body.ServiceID})
}

// UnassignService unlinks a service from a FAQ.
//
//	DELETE /api/v1/faqs/{id}/services/{service_id}
func (h *FaqHandler) UnassignService(w http.ResponseWriter, r *http.Request) {
	faqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}
	serviceID, err := uuid.Parse(chi.URLParam(r, "service_id"))
	if err != nil {
		response.BadRequest(w, "invalid service_id")
		return
	}

	if err := h.repo.UnassignService(r.Context(), faqID, serviceID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AssignPortal links a FAQ to a portal.
//
//	POST /api/v1/faqs/{id}/portals
func (h *FaqHandler) AssignPortal(w http.ResponseWriter, r *http.Request) {
	faqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}

	var body struct {
		PortalID uuid.UUID `json:"portal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if err := h.repo.AssignPortal(r.Context(), faqID, body.PortalID); err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"faq_id": faqID, "portal_id": body.PortalID})
}

// UnassignPortal unlinks a portal from a FAQ.
//
//	DELETE /api/v1/faqs/{id}/portals/{portal_id}
func (h *FaqHandler) UnassignPortal(w http.ResponseWriter, r *http.Request) {
	faqID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid faq id")
		return
	}
	portalID, err := uuid.Parse(chi.URLParam(r, "portal_id"))
	if err != nil {
		response.BadRequest(w, "invalid portal_id")
		return
	}

	if err := h.repo.UnassignPortal(r.Context(), faqID, portalID); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
