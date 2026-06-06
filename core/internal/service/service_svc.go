package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/repository"
)

type ServiceSvc struct {
	repo *repository.ServiceRepo
}

func NewServiceSvc(repo *repository.ServiceRepo) *ServiceSvc {
	return &ServiceSvc{repo: repo}
}

func (s *ServiceSvc) Create(ctx context.Context, input domain.CreateServiceInput) (*domain.Service, error) {
	return s.repo.Create(ctx, input)
}

func (s *ServiceSvc) List(ctx context.Context, onlyActive bool) ([]*domain.Service, error) {
	return s.repo.List(ctx, onlyActive)
}

func (s *ServiceSvc) EnableForTenant(ctx context.Context, input domain.EnableServiceInput) (*domain.TenantService, error) {
	return s.repo.EnableForTenant(ctx, input)
}

func (s *ServiceSvc) DisableForTenant(ctx context.Context, tenantID, serviceID uuid.UUID) error {
	return s.repo.DisableForTenant(ctx, tenantID, serviceID)
}

func (s *ServiceSvc) GetTenantServices(ctx context.Context, tenantID uuid.UUID) ([]*domain.TenantService, error) {
	return s.repo.GetTenantServices(ctx, tenantID)
}
