package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, input domain.CreateUserInput) (*domain.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	var u domain.User
	err = r.db.QueryRow(ctx, `
		INSERT INTO users (tenant_id, portal_id, email, password_hash, role_id)
		VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5 AND service_id IS NULL))
		RETURNING id, tenant_id, portal_id, email, password_hash,
		          role_id, (SELECT name FROM roles WHERE id = role_id),
		          is_active, last_login_at, created_at, updated_at
	`, input.TenantID, input.PortalID, input.Email, string(hash), input.Role).
		Scan(&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
			&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.portal_id, u.email, u.password_hash,
		       u.role_id, r.name,
		       u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.id = $1
	`, id).Scan(&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
		&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id, u.tenant_id, u.portal_id, u.email, u.password_hash,
		       u.role_id, r.name,
		       u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.tenant_id = $1
		ORDER BY u.email
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list users by tenant: %w", err)
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
			&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, rows.Err()
}

func (r *UserRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateUserInput) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		UPDATE users SET
			portal_id  = COALESCE($2, portal_id),
			role_id    = COALESCE((SELECT id FROM roles WHERE name = $3 AND service_id IS NULL), role_id),
			is_active  = COALESCE($4, is_active),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, tenant_id, portal_id, email, password_hash,
		          role_id, (SELECT name FROM roles WHERE id = role_id),
		          is_active, last_login_at, created_at, updated_at
	`, id, input.PortalID, input.Role, input.IsActive).
		Scan(&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
			&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}
