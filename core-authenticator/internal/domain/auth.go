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
	// RestrictServices, when true, means the JWT's services claim must be
	// built from this user's user_service_access grants (via
	// AuthRepo.GetGrantedServiceIDs) instead of every service the tenant is
	// adhered to (AuthRepo.GetTenantServiceIDs). See
	// core-backend/migrations/034_add_restrict_services_to_users.sql.
	RestrictServices bool       `json:"restrict_services"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ResolvedAccess is a fresh, DB-backed user_service_access grant resolved at
// /auth/validate time — additive to the JWT-derived claims, never replacing
// them.
type ResolvedAccess struct {
	BusinessID uuid.UUID
	Role       string
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	UserAgent string     `json:"user_agent"`
	IPAddress string     `json:"ip_address"`
	CreatedAt time.Time  `json:"created_at"`
}

type UserRepository interface {
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*User, error)
	GetByEmailGlobal(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
	SaveRefreshToken(ctx context.Context, token RefreshToken) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, tokenHash string) error
}
