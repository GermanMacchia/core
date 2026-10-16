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

	"github.com/tu-org/core-backend/internal/cache"
	"github.com/tu-org/core-backend/internal/config"
	"github.com/tu-org/core-backend/internal/db"
	"github.com/tu-org/core-backend/internal/handler"
	"github.com/tu-org/core-backend/internal/middleware"
	"github.com/tu-org/core-backend/internal/repository"
	"github.com/tu-org/core-backend/internal/seed"
	"github.com/tu-org/core-backend/internal/service"
	pkgjwt "github.com/tu-org/core-backend/pkg/jwt"
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
	deploymentRepo := repository.NewDeploymentRepo(pool)
	userRepo := repository.NewUserRepo(pool)
	portalRepo := repository.NewPortalRepo(pool)
	planRepo := repository.NewPlanRepo(pool)
	configDefinitionRepo := repository.NewConfigDefinitionRepo(pool)
	faqRepo := repository.NewFaqRepo(pool)
	userServiceAccessRepo := repository.NewUserServiceAccessRepo(pool)
	serviceInstanceRepo := repository.NewServiceInstanceRepo(pool)
	tenantServiceRepo := repository.NewTenantServiceRepo(pool)
	roleRepo := repository.NewRoleRepo(pool)

	// JWT
	jwtManager := pkgjwt.NewManager(cfg.JWT.Secret)

	// Services
	tenantSvc := service.NewTenantService(tenantRepo, userRepo)
	serviceSvc := service.NewServiceSvc(serviceRepo)
	deploymentSvc := service.NewDeploymentSvc(deploymentRepo)
	faqSvc := service.NewFaqSvc(faqRepo)

	// Handlers
	tenantHandler := handler.NewTenantHandler(tenantSvc, portalRepo, userServiceAccessRepo, serviceInstanceRepo, tenantServiceRepo)
	serviceHandler := handler.NewServiceHandler(serviceSvc, roleRepo)
	deploymentHandler := handler.NewDeploymentHandler(deploymentSvc)
	portalHandler := handler.NewPortalHandler(portalRepo, tenantRepo, serviceRepo, tenantServiceRepo)
	planHandler := handler.NewPlanHandler(planRepo)
	configDefinitionHandler := handler.NewConfigDefinitionHandler(configDefinitionRepo)
	cacheHandler := handler.NewCacheHandler(redisCache)
	faqHandler := handler.NewFaqHandler(faqSvc, faqRepo)

	// Middleware
	jwtMW := middleware.NewJWTMiddleware(jwtManager, redisCache)
	tenantResolverMW := middleware.NewTenantResolver(tenantRepo, redisCache)
	rateLimiterMW := middleware.NewRateLimiter(redisCache, 60)
	apiKeyMW := middleware.NewAPIKeyMiddleware(cfg.PublicAPIKey)
	serviceAPIKeyMW := middleware.NewAPIKeyMiddleware(cfg.ServiceAPIKey)

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

	// Public routes — API key required, no JWT
	r.Group(func(r chi.Router) {
		r.Use(apiKeyMW.Verify)
		r.With(tenantResolverMW.Resolve).Get("/api/v1/public/config", tenantHandler.PublicConfig)
		r.With(tenantResolverMW.Resolve).Get("/api/v1/public/services", tenantHandler.PublicServices)
		r.Get("/api/v1/public/portals/{portal_id}", portalHandler.PublicConfig)
	})

	// Services routes — Service API key required
	r.Group(func(r chi.Router) {
		r.Use(serviceAPIKeyMW.Verify)
		r.Get("/api/v1/public/services/{service_identifier}/tenants", tenantHandler.PublicListByService)
		r.Get("/api/v1/public/services/{service_identifier}/instances", tenantHandler.PublicListInstancesByService)
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
		r.Post("/api/v1/tenants/{id}/services", tenantHandler.AssignService)
		r.Delete("/api/v1/tenants/{id}/services/{service_id}", tenantHandler.UnassignService)
		r.Patch("/api/v1/tenants/{id}/services/{service_id}/instance", tenantHandler.UpdateInstance)
		r.Get("/api/v1/tenants/{id}/users", tenantHandler.GetUsers)
		r.Post("/api/v1/tenants/{id}/users", tenantHandler.CreateUser)
		r.Patch("/api/v1/tenants/{id}/users/{uid}", tenantHandler.UpdateUser)
		r.Delete("/api/v1/tenants/{id}/users/{uid}", tenantHandler.DeleteUser)
		r.Get("/api/v1/tenants/{id}/users/{uid}/service-access", tenantHandler.ListUserServiceAccess)
		r.Post("/api/v1/tenants/{id}/users/{uid}/service-access", tenantHandler.CreateUserServiceAccess)
		r.Delete("/api/v1/tenants/{id}/users/{uid}/service-access/{grant_id}", tenantHandler.DeleteUserServiceAccess)

		// Portal management
		r.Patch("/api/v1/portals/{portal_id}", portalHandler.UpdatePortal)

		// Portal service management
		r.Post("/api/v1/portals/{portal_id}/services", portalHandler.AssignService)
		r.Patch("/api/v1/portals/{portal_id}/services/{service_id}", portalHandler.UpdatePortalService)
		r.Delete("/api/v1/portals/{portal_id}/services/{service_id}", portalHandler.UnassignService)

		// Service catalog
		r.Get("/api/v1/services", serviceHandler.List)
		r.Get("/api/v1/services/{id}", serviceHandler.Get)
		r.Get("/api/v1/services/{id}/roles", serviceHandler.ListRoles)

		// FAQs (role-branching inside the handler)
		r.Get("/api/v1/faqs", faqHandler.List)

		// Plans
		r.Get("/api/v1/plans", planHandler.List)
		r.Get("/api/v1/plans/{id}", planHandler.Get)
		r.Get("/api/v1/plans/{id}/services", planHandler.ListServicePricing)

		// Portal management (tenant-scoped)
		r.Get("/api/v1/tenants/{id}/portals", portalHandler.ListByTenant)
		r.Post("/api/v1/tenants/{id}/portals", portalHandler.CreatePortal)

		// Portal service management
		r.Get("/api/v1/portals/{portal_id}/services", portalHandler.GetServicesAuth)

		// Internal (platform-operator) only
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireInternalAccess(userServiceAccessRepo))
			r.Get("/api/v1/tenants", tenantHandler.List)
			r.Post("/api/v1/tenants", tenantHandler.Create)
			r.Delete("/api/v1/tenants/{id}", tenantHandler.Delete)
			r.Get("/api/v1/portals", portalHandler.ListAll)
			r.Post("/api/v1/services", serviceHandler.Create)
			r.Patch("/api/v1/services/{id}", serviceHandler.Update)
			r.Delete("/api/v1/services/{id}", serviceHandler.Delete)
			r.Post("/api/v1/services/{id}/roles", serviceHandler.CreateRole)
			r.Patch("/api/v1/roles/{role_id}", serviceHandler.UpdateRole)
			r.Delete("/api/v1/roles/{role_id}", serviceHandler.DeleteRole)

			// Deployments (apps deployed once by the platform; services rest on them)
			r.Get("/api/v1/deployments", deploymentHandler.List)
			r.Get("/api/v1/deployments/{id}", deploymentHandler.Get)
			r.Post("/api/v1/deployments", deploymentHandler.Create)
			r.Patch("/api/v1/deployments/{id}", deploymentHandler.Update)
			r.Delete("/api/v1/deployments/{id}", deploymentHandler.Delete)

			r.Post("/api/v1/plans", planHandler.Create)
			r.Patch("/api/v1/plans/{id}", planHandler.Update)
			r.Delete("/api/v1/plans/{id}", planHandler.Delete)
			r.Put("/api/v1/plans/{id}/services/{service_id}", planHandler.SetServicePricing)
			r.Delete("/api/v1/plans/{id}/services/{service_id}", planHandler.RemoveServicePricing)

			// Config Definitions
			r.Get("/api/v1/config-definitions", configDefinitionHandler.List)
			r.Get("/api/v1/config-definitions/{scope}/{key}", configDefinitionHandler.Get)
			r.Post("/api/v1/config-definitions", configDefinitionHandler.Create)
			r.Patch("/api/v1/config-definitions/{scope}/{key}", configDefinitionHandler.Update)
			r.Delete("/api/v1/config-definitions/{scope}/{key}", configDefinitionHandler.Delete)

			// Cache Management
			r.Post("/api/v1/cache/reset", cacheHandler.Reset)

			// FAQs
			r.Post("/api/v1/faqs", faqHandler.Create)
			r.Patch("/api/v1/faqs/{id}", faqHandler.Update)
			r.Delete("/api/v1/faqs/{id}", faqHandler.Delete)
			r.Post("/api/v1/faqs/{id}/services", faqHandler.AssignService)
			r.Delete("/api/v1/faqs/{id}/services/{service_id}", faqHandler.UnassignService)
			r.Post("/api/v1/faqs/{id}/portals", faqHandler.AssignPortal)
			r.Delete("/api/v1/faqs/{id}/portals/{portal_id}", faqHandler.UnassignPortal)
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
