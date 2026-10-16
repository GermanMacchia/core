package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/repository"
)

type DeploymentSvc struct {
	repo *repository.DeploymentRepo
}

func NewDeploymentSvc(repo *repository.DeploymentRepo) *DeploymentSvc {
	return &DeploymentSvc{repo: repo}
}

func (s *DeploymentSvc) Create(ctx context.Context, input domain.CreateDeploymentInput) (*domain.Deployment, error) {
	return s.repo.Create(ctx, input)
}

func (s *DeploymentSvc) GetByID(ctx context.Context, id uuid.UUID) (*domain.Deployment, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *DeploymentSvc) List(ctx context.Context, onlyActive bool) ([]*domain.Deployment, error) {
	return s.repo.List(ctx, onlyActive)
}

func (s *DeploymentSvc) Update(ctx context.Context, id uuid.UUID, input domain.UpdateDeploymentInput) (*domain.Deployment, error) {
	return s.repo.Update(ctx, id, input)
}

func (s *DeploymentSvc) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
