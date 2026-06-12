package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleSuperAdmin UserRole = "superadmin"
	RoleAdmin      UserRole = "admin"
	RoleMember     UserRole = "member"
	RoleViewer     UserRole = "viewer"
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	PortalID     *uuid.UUID `json:"portal_id,omitempty"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	RoleID       uuid.UUID  `json:"role_id"`
	Role         UserRole   `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type CreateUserInput struct {
	TenantID uuid.UUID  `json:"tenant_id"`
	PortalID *uuid.UUID `json:"portal_id,omitempty"`
	Email    string     `json:"email"`
	Password string     `json:"password"`
	Role     UserRole   `json:"role"`
}

type UpdateUserInput struct {
	PortalID *uuid.UUID `json:"portal_id,omitempty"`
	Role     *UserRole  `json:"role,omitempty"`
	IsActive *bool      `json:"is_active,omitempty"`
}

type UserRepository interface {
	Create(ctx context.Context, input CreateUserInput) (*User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*User, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateUserInput) (*User, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
