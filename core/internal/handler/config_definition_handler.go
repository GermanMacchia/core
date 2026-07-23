package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/pkg/response"
)

type ConfigDefinitionHandler struct {
	repo domain.ConfigDefinitionRepository
}

func NewConfigDefinitionHandler(repo domain.ConfigDefinitionRepository) *ConfigDefinitionHandler {
	return &ConfigDefinitionHandler{repo: repo}
}

func (h *ConfigDefinitionHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context())
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, list)
}

func (h *ConfigDefinitionHandler) Get(w http.ResponseWriter, r *http.Request) {
	scope := chi.URLParam(r, "scope")
	key := chi.URLParam(r, "key")
	if scope == "" || key == "" {
		response.BadRequest(w, "scope and key are required")
		return
	}

	cd, err := h.repo.Get(r.Context(), scope, key)
	if err != nil {
		response.NotFound(w)
		return
	}
	response.JSON(w, http.StatusOK, cd)
}

func (h *ConfigDefinitionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateConfigDefinitionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if input.Key == "" || input.Scope == "" || input.Type == "" {
		response.BadRequest(w, "key, scope and type are required")
		return
	}

	if input.Scope != "service" && input.Scope != "portal" && input.Scope != "tenant" && input.Scope != "plan" {
		response.BadRequest(w, "invalid scope: must be 'service', 'portal', 'tenant', or 'plan'")
		return
	}

	if input.Type != "bool" && input.Type != "string" && input.Type != "string[]" {
		response.BadRequest(w, "invalid type: must be 'bool', 'string', or 'string[]'")
		return
	}

	cd, err := h.repo.Create(r.Context(), input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, cd)
}

func (h *ConfigDefinitionHandler) Update(w http.ResponseWriter, r *http.Request) {
	scope := chi.URLParam(r, "scope")
	key := chi.URLParam(r, "key")
	if scope == "" || key == "" {
		response.BadRequest(w, "scope and key are required")
		return
	}

	var input domain.UpdateConfigDefinitionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if input.Type != nil && *input.Type != "bool" && *input.Type != "string" && *input.Type != "string[]" {
		response.BadRequest(w, "invalid type: must be 'bool', 'string', or 'string[]'")
		return
	}

	cd, err := h.repo.Update(r.Context(), scope, key, input)
	if err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, cd)
}

func (h *ConfigDefinitionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	scope := chi.URLParam(r, "scope")
	key := chi.URLParam(r, "key")
	if scope == "" || key == "" {
		response.BadRequest(w, "scope and key are required")
		return
	}

	if err := h.repo.Delete(r.Context(), scope, key); err != nil {
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
