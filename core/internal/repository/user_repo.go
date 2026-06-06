package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/domain"
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
		INSERT INTO users (tenant_id, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, tenant_id, email, password_hash, role, is_active, last_login_at, created_at, updated_at
	`, input.TenantID, input.Email, string(hash), input.Role).
		Scan(&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT id, tenant_id, email, password_hash, role, is_active, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, tenant_id, email, password_hash, role, is_active, last_login_at, created_at, updated_at
		FROM users WHERE tenant_id = $1 ORDER BY email
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list users by tenant: %w", err)
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, rows.Err()
}
