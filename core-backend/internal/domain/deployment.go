package domain

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrDeploymentInUse is returned by DeploymentRepository.Delete when the
// deployment is still referenced by services.deployment_id.
var ErrDeploymentInUse = errors.New("deployment is in use by one or more services")

// Deployment is an app deployed once by the platform, with one canonical URL.
// Services (the commercial offering) rest on a deployment: N services : 1
// deployment. A deployment may exist without services.
type Deployment struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	URL         string    `json:"url"`
	APIURL      *string   `json:"api_url,omitempty"`
	Version     string    `json:"version"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateDeploymentInput struct {
	Name        string  `json:"name"`
	URL         string  `json:"url"`
	APIURL      *string `json:"api_url,omitempty"`
	Version     string  `json:"version"`
	Description *string `json:"description,omitempty"`
}

type UpdateDeploymentInput struct {
	Name        *string `json:"name,omitempty"`
	URL         *string `json:"url,omitempty"`
	APIURL      *string `json:"api_url,omitempty"`
	Version     *string `json:"version,omitempty"`
	Description *string `json:"description,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

type DeploymentRepository interface {
	Create(ctx context.Context, input CreateDeploymentInput) (*Deployment, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Deployment, error)
	List(ctx context.Context, onlyActive bool) ([]*Deployment, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateDeploymentInput) (*Deployment, error)
	// Delete removes a deployment by id. Returns ErrDeploymentInUse if any
	// service still references it.
	Delete(ctx context.Context, id uuid.UUID) error
}
