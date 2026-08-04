package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"go.uber.org/zap"

	"github.com/tu-org/core-authenticator/internal/cache"
	"github.com/tu-org/core-authenticator/internal/config"
	"github.com/tu-org/core-authenticator/internal/db"
	"github.com/tu-org/core-authenticator/internal/handler"
	"github.com/tu-org/core-authenticator/internal/middleware"
	"github.com/tu-org/core-authenticator/internal/repository"
	"github.com/tu-org/core-authenticator/internal/service"
	pkgjwt "github.com/tu-org/core-authenticator/pkg/jwt"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("load config", zap.Error(err))
	}

	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DB)
	if err != nil {
		logger.Fatal("connect db", zap.Error(err))
	}
	defer pool.Close()
	logger.Info("connected to postgres")

	redisCache, err := cache.New(cfg.Redis)
	if err != nil {
		logger.Fatal("connect redis", zap.Error(err))
	}
	logger.Info("connected to redis")

	jwtManager := pkgjwt.NewManager(cfg.JWT.Secret)
	authRepo := repository.NewAuthRepo(pool)
	auditRepo := repository.NewAuditRepo(pool)
	authSvc := service.NewAuthService(authRepo, auditRepo, jwtManager, cfg.JWT)
	authHandler := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.CORS(cfg.CORS.AllowedOrigins))
	r.Use(rateLimiter(redisCache))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.With(loginRateLimiter(redisCache)).Post("/auth/login", authHandler.Login)
	r.Post("/auth/refresh", authHandler.Refresh)
	r.Post("/auth/logout", authHandler.Logout)
	r.Get("/auth/validate", authHandler.Validate)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		logger.Info("authenticator starting", zap.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	<-quit
	logger.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", zap.Error(err))
	}
	logger.Info("server stopped")
}

// rateLimiter is a global rate limiter (60 req/min per IP).
func rateLimiter(c *cache.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := realIP(r)
			key := cache.RateLimitKey(ip, r.URL.Path)
			count, err := c.Incr(r.Context(), key, cache.TTLRateLimit)
			if err == nil && count > 60 {
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// loginRateLimiter applies a stricter limit (10 req/min per IP) to the login endpoint
// to slow down brute-force credential attacks.
func loginRateLimiter(c *cache.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := realIP(r)
			key := cache.RateLimitKey(ip, "auth:login:strict")
			count, err := c.Incr(r.Context(), key, cache.TTLRateLimit)
			if err == nil && count > 10 {
				http.Error(w, `{"error":"too many login attempts, please try again later"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
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
