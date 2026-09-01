package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/tu-org/core-backend/internal/domain"
	"github.com/tu-org/core-backend/internal/repository"
)

type FaqSvc struct {
	repo *repository.FaqRepo
}

func NewFaqSvc(repo *repository.FaqRepo) *FaqSvc {
	return &FaqSvc{repo: repo}
}

func (s *FaqSvc) List(ctx context.Context, onlyActive bool) ([]*domain.Faq, error) {
	return s.repo.List(ctx, onlyActive)
}

func (s *FaqSvc) GetByID(ctx context.Context, id uuid.UUID) (*domain.Faq, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *FaqSvc) Create(ctx context.Context, input domain.CreateFaqInput) (*domain.Faq, error) {
	return s.repo.Create(ctx, input)
}

func (s *FaqSvc) Update(ctx context.Context, id uuid.UUID, input domain.UpdateFaqInput) (*domain.Faq, error) {
	return s.repo.Update(ctx, id, input)
}

func (s *FaqSvc) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
