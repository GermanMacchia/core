package handler

import (
	"net/http"

	"github.com/tu-org/core-backend/internal/cache"
	"github.com/tu-org/core-backend/pkg/response"
)

type CacheHandler struct {
	cache *cache.Cache
}

func NewCacheHandler(cache *cache.Cache) *CacheHandler {
	return &CacheHandler{cache: cache}
}

func (h *CacheHandler) Reset(w http.ResponseWriter, r *http.Request) {
	if err := h.cache.FlushDB(r.Context()); err != nil {
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "cache reset successfully"})
}
