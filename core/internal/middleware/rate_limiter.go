package middleware

import (
	"net/http"

	"github.com/tu-org/tenant-core/internal/cache"
	"github.com/tu-org/tenant-core/pkg/response"
)

const defaultRateLimit = 60

type RateLimiter struct {
	cache     *cache.Cache
	maxPerMin int
}

func NewRateLimiter(c *cache.Cache, maxPerMin int) *RateLimiter {
	if maxPerMin <= 0 {
		maxPerMin = defaultRateLimit
	}
	return &RateLimiter{cache: c, maxPerMin: maxPerMin}
}

func (rl *RateLimiter) ByIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := realIP(r)
		key := cache.RateLimitKey(ip, r.URL.Path)

		count, err := rl.cache.Incr(r.Context(), key, cache.TTLRateLimit)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		if int(count) > rl.maxPerMin {
			response.Error(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}
