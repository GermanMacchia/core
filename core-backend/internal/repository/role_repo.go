package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.RoleRepository = (*RoleRepo)(nil)

type RoleRepo struct {
	db *pgxpool.Pool
}

func NewRoleRepo(db *pgxpool.Pool) *RoleRepo {
	return &RoleRepo{db: db}
}

// ListByService returns every role scoped to serviceID, ordered by name.
func (r *RoleRepo) ListByService(ctx context.Context, serviceID uuid.UUID) ([]*domain.Role, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, description, service_id
		FROM roles
		WHERE service_id = $1
		ORDER BY name
	`, serviceID)
	if err != nil {
		return nil, fmt.Errorf("list roles by service: %w", err)
	}
	defer rows.Close()

	var roles []*domain.Role
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.ServiceID); err != nil {
			return nil, err
		}
		roles = append(roles, &role)
	}
	return roles, rows.Err()
}

// Create inserts a new role scoped to input.ServiceID.
func (r *RoleRepo) Create(ctx context.Context, input domain.CreateRoleInput) (*domain.Role, error) {
	var role domain.Role
	err := r.db.QueryRow(ctx, `
		INSERT INTO roles (name, description, service_id)
		VALUES ($1, $2, $3)
		RETURNING id, name, description, service_id
	`, input.Name, input.Description, input.ServiceID).
		Scan(&role.ID, &role.Name, &role.Description, &role.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("create role: %w", err)
	}
	return &role, nil
}

// Update partially updates a role by id.
func (r *RoleRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateRoleInput) (*domain.Role, error) {
	var role domain.Role
	err := r.db.QueryRow(ctx, `
		UPDATE roles SET
			name        = COALESCE($2, name),
			description = COALESCE($3, description)
		WHERE id = $1
		RETURNING id, name, description, service_id
	`, id, input.Name, input.Description).
		Scan(&role.ID, &role.Name, &role.Description, &role.ServiceID)
	if err != nil {
		return nil, fmt.Errorf("update role: %w", err)
	}
	return &role, nil
}

// Delete removes a role by id, refusing if it is still referenced by
// users.role_id or user_service_access.role_id.
func (r *RoleRepo) Delete(ctx context.Context, id uuid.UUID) error {
	var inUse bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE role_id = $1)
			OR EXISTS(SELECT 1 FROM user_service_access WHERE role_id = $1)
	`, id).Scan(&inUse)
	if err != nil {
		return fmt.Errorf("check role in use: %w", err)
	}
	if inUse {
		return domain.ErrRoleInUse
	}

	_, err = r.db.Exec(ctx, `DELETE FROM roles WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete role: %w", err)
	}
	return nil
}
