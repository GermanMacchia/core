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

	"github.com/tu-org/tenant-core/internal/cache"
	"github.com/tu-org/tenant-core/internal/config"
	"github.com/tu-org/tenant-core/internal/db"
	"github.com/tu-org/tenant-core/internal/handler"
	"github.com/tu-org/tenant-core/internal/middleware"
	"github.com/tu-org/tenant-core/internal/repository"
	"github.com/tu-org/tenant-core/internal/seed"
	"github.com/tu-org/tenant-core/internal/service"
	pkgjwt "github.com/tu-org/tenant-core/pkg/jwt"
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

	if err := seed.Run(ctx, pool, cfg.Seed, cfg.Env, logger); err != nil {
		logger.Fatal("seed failed", zap.Error(err))
	}

	redisCache, err := cache.New(cfg.Redis)
	if err != nil {
		logger.Fatal("connect redis", zap.Error(err))
	}
	logger.Info("connected to redis")

	// Repositories
	tenantRepo := repository.NewTenantRepo(pool)
	serviceRepo := repository.NewServiceRepo(pool)
	userRepo := repository.NewUserRepo(pool)

	// JWT
	jwtManager := pkgjwt.NewManager(cfg.JWT.Secret)

	// Services
	tenantSvc := service.NewTenantService(tenantRepo, userRepo)
	serviceSvc := service.NewServiceSvc(serviceRepo)

	// Handlers
	tenantHandler := handler.NewTenantHandler(tenantSvc, serviceSvc)
	serviceHandler := handler.NewServiceHandler(serviceSvc)

	// Middleware
	jwtMW := middleware.NewJWTMiddleware(jwtManager, redisCache)
	tenantResolverMW := middleware.NewTenantResolver(tenantRepo, redisCache)
	rateLimiterMW := middleware.NewRateLimiter(redisCache, 60)

	// Router
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.CORS(cfg.CORS.AllowedOrigins))
	r.Use(rateLimiterMW.ByIP)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(jwtMW.Verify)
		r.Use(tenantResolverMW.Resolve)

		r.Get("/api/v1/me/context", tenantHandler.Context)

		// Tenant management
		r.Get("/api/v1/tenants/{id}", tenantHandler.Get)
		r.Patch("/api/v1/tenants/{id}", tenantHandler.Update)
		r.Get("/api/v1/tenants/{id}/services", tenantHandler.GetServices)
		r.Post("/api/v1/tenants/{id}/services", tenantHandler.EnableService)
		r.Delete("/api/v1/tenants/{id}/services/{sid}", tenantHandler.DisableService)
		r.Get("/api/v1/tenants/{id}/users", tenantHandler.GetUsers)
		r.Post("/api/v1/tenants/{id}/users", tenantHandler.CreateUser)

		// Service catalog
		r.Get("/api/v1/services", serviceHandler.List)

		// Superadmin only
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("superadmin"))
			r.Get("/api/v1/tenants", tenantHandler.List)
			r.Post("/api/v1/tenants", tenantHandler.Create)
			r.Delete("/api/v1/tenants/{id}", tenantHandler.Delete)
			r.Post("/api/v1/services", serviceHandler.Create)
		})
	})

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
		logger.Info("server starting", zap.String("port", cfg.Port))
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
