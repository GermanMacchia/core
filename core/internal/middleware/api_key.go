package middleware

import (
	"net/http"

	"github.com/tu-org/tenant-core/pkg/response"
)

type APIKeyMiddleware struct {
	key string
}

func NewAPIKeyMiddleware(key string) *APIKeyMiddleware {
	return &APIKeyMiddleware{key: key}
}

func (m *APIKeyMiddleware) Verify(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Api-Key")
		if key == "" || key != m.key {
			response.Unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}
