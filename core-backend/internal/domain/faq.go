package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Faq struct {
	ID         uuid.UUID   `json:"id"`
	Question   string      `json:"question"`
	Answer     string      `json:"answer"`
	SortOrder  int         `json:"sort_order"`
	IsActive   bool        `json:"is_active"`
	ServiceIDs []uuid.UUID `json:"service_ids"`
	PortalIDs  []uuid.UUID `json:"portal_ids"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

type CreateFaqInput struct {
	Question  string `json:"question"`
	Answer    string `json:"answer"`
	SortOrder int    `json:"sort_order"`
}

type UpdateFaqInput struct {
	Question  *string `json:"question,omitempty"`
	Answer    *string `json:"answer,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
	IsActive  *bool   `json:"is_active,omitempty"`
}

type FaqRepository interface {
	List(ctx context.Context, onlyActive bool) ([]*Faq, error)
	ListVisibleForTenant(ctx context.Context, tenantID uuid.UUID) ([]*Faq, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Faq, error)
	Create(ctx context.Context, input CreateFaqInput) (*Faq, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateFaqInput) (*Faq, error)
	Delete(ctx context.Context, id uuid.UUID) error
	AssignService(ctx context.Context, faqID, serviceID uuid.UUID) error
	UnassignService(ctx context.Context, faqID, serviceID uuid.UUID) error
	AssignPortal(ctx context.Context, faqID, portalID uuid.UUID) error
	UnassignPortal(ctx context.Context, faqID, portalID uuid.UUID) error
}
