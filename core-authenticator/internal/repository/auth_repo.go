package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-authenticator/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type AuthRepo struct {
	db *pgxpool.Pool
}

func NewAuthRepo(db *pgxpool.Pool) *AuthRepo {
	return &AuthRepo{db: db}
}

func (r *AuthRepo) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.portal_id, u.email, u.password_hash,
		       u.role_id, ro.name,
		       u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.tenant_id = $1 AND u.email = $2
	`, tenantID, email).Scan(
		&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
		&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return &u, nil
}

func (r *AuthRepo) GetByEmailGlobal(ctx context.Context, email string) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.portal_id, u.email, u.password_hash,
		       u.role_id, ro.name,
		       u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.email = $1 AND ro.name = 'superadmin'
		LIMIT 1
	`, email).Scan(
		&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
		&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by email global: %w", err)
	}
	return &u, nil
}

func (r *AuthRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.portal_id, u.email, u.password_hash,
		       u.role_id, ro.name,
		       u.is_active, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN roles ro ON ro.id = u.role_id
		WHERE u.id = $1
	`, id).Scan(
		&u.ID, &u.TenantID, &u.PortalID, &u.Email, &u.PasswordHash,
		&u.RoleID, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &u, nil
}

func (r *AuthRepo) GetTenantStatus(ctx context.Context, tenantID uuid.UUID) (string, error) {
	var status string
	err := r.db.QueryRow(ctx, `SELECT status FROM tenants WHERE id = $1`, tenantID).Scan(&status)
	if err != nil {
		return "", fmt.Errorf("get tenant status: %w", err)
	}
	return status, nil
}

func (r *AuthRepo) GetTenantServiceIDs(ctx context.Context, tenantID uuid.UUID) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT s.id::text
		FROM portal_services ps
		JOIN tenant_portals p ON p.id = ps.portal_id
		JOIN services s       ON s.id = ps.service_id
		WHERE p.tenant_id   = $1
		  AND ps.is_enabled = TRUE
		  AND s.is_active   = TRUE
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get tenant service ids: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *AuthRepo) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	_, err := r.db.Exec(ctx, `UPDATE users SET last_login_at = $2, updated_at = NOW() WHERE id = $1`, id, now)
	return err
}

func (r *AuthRepo) SaveRefreshToken(ctx context.Context, token domain.RefreshToken) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, token.ID, token.UserID, token.TokenHash, token.ExpiresAt, token.UserAgent, token.IPAddress)
	return err
}

func (r *AuthRepo) GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	var t domain.RefreshToken
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at
		FROM refresh_tokens WHERE token_hash = $1
	`, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.RevokedAt,
		&t.UserAgent, &t.IPAddress, &t.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get refresh token: %w", err)
	}
	return &t, nil
}

func (r *AuthRepo) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	now := time.Now()
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = $2 WHERE token_hash = $1`, tokenHash, now,
	)
	return err
}

// HashPassword is exported so the seed command can use it directly.
func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}
