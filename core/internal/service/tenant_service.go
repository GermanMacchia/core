package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/tu-org/tenant-core/internal/domain"
	"github.com/tu-org/tenant-core/internal/repository"
)

var ErrTenantNotFound = errors.New("tenant not found")

type TenantService struct {
	repo     *repository.TenantRepo
	userRepo *repository.UserRepo
}

func NewTenantService(repo *repository.TenantRepo, userRepo *repository.UserRepo) *TenantService {
	return &TenantService{repo: repo, userRepo: userRepo}
}

func (s *TenantService) Create(ctx context.Context, input domain.CreateTenantInput) (*domain.Tenant, error) {
	return s.repo.Create(ctx, input)
}

func (s *TenantService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *TenantService) List(ctx context.Context, limit, offset int) ([]*domain.Tenant, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.List(ctx, limit, offset)
}

func (s *TenantService) Update(ctx context.Context, id uuid.UUID, input domain.UpdateTenantInput) (*domain.Tenant, error) {
	return s.repo.Update(ctx, id, input)
}

func (s *TenantService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *TenantService) GetUsers(ctx context.Context, tenantID uuid.UUID) ([]*domain.User, error) {
	return s.userRepo.ListByTenant(ctx, tenantID)
}

func (s *TenantService) CreateUser(ctx context.Context, input domain.CreateUserInput) (*domain.User, error) {
	if input.Role == "" {
		input.Role = domain.RoleMember
	}
	return s.userRepo.Create(ctx, input)
}

func (s *TenantService) UpdateUser(ctx context.Context, id uuid.UUID, input domain.UpdateUserInput) (*domain.User, error) {
	return s.userRepo.Update(ctx, id, input)
}

func (s *TenantService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	return s.userRepo.Delete(ctx, id)
}

func (s *TenantService) ListByService(ctx context.Context, serviceIdentifier string) ([]*domain.Tenant, error) {
	return s.repo.ListByService(ctx, serviceIdentifier)
}

