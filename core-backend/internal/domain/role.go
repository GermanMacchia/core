package domain

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// ErrRoleInUse is returned by RoleRepository.Delete when the role is still
// referenced by users.role_id or user_service_access.role_id. Deletion is
// blocked instead of relying on the DB, because user_service_access.role_id
// has ON DELETE CASCADE (migrations/031_create_user_service_access.sql) and
// would silently wipe access grants otherwise.
var ErrRoleInUse = errors.New("role is in use and cannot be deleted")

// Role is a roles row scoped to a single service (roles.service_id) — see
// migrations/029_add_service_id_to_roles.sql and
// migrations/030_scope_existing_roles_and_seed_per_service.sql. The
// historical global roles (service_id IS NULL: superadmin/admin/member/
// viewer) predate per-service scoping and are not returned by ListByService.
type Role struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	ServiceID   uuid.UUID `json:"service_id"`
}

// CreateRoleInput carries the fields needed to create a role scoped to a
// service.
type CreateRoleInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	ServiceID   uuid.UUID
}

// UpdateRoleInput carries the optional fields for a partial role update.
// Pointer fields left nil are not modified.
type UpdateRoleInput struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// RoleRepository backs the per-service role catalog used to populate the
// role selector when granting a user_service_access grant.
type RoleRepository interface {
	// ListByService returns every role scoped to serviceID
	// (roles.service_id = serviceID), ordered by name.
	ListByService(ctx context.Context, serviceID uuid.UUID) ([]*Role, error)

	// Create inserts a new role scoped to input.ServiceID.
	Create(ctx context.Context, input CreateRoleInput) (*Role, error)

	// Update partially updates a role by id.
	Update(ctx context.Context, id uuid.UUID, input UpdateRoleInput) (*Role, error)

	// Delete removes a role by id. Returns ErrRoleInUse if the role is
	// still referenced by users.role_id or user_service_access.role_id.
	Delete(ctx context.Context, id uuid.UUID) error
}
