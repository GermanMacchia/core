package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.UserServiceAccessRepository = (*UserServiceAccessRepo)(nil)

type UserServiceAccessRepo struct {
	db *pgxpool.Pool
}

func NewUserServiceAccessRepo(db *pgxpool.Pool) *UserServiceAccessRepo {
	return &UserServiceAccessRepo{db: db}
}

// HasTenantGrant reports whether userID holds a user_service_access grant on
// any service_instance belonging to tenantID.
func (r *UserServiceAccessRepo) HasTenantGrant(ctx context.Context, userID, tenantID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM user_service_access usa
			JOIN service_instances si ON si.id = usa.service_instance_id
			JOIN tenant_services ts   ON ts.id = si.tenant_service_id
			WHERE usa.user_id = $1 AND ts.tenant_id = $2
		)
	`, userID, tenantID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("has tenant grant: %w", err)
	}
	return exists, nil
}

// HasServiceGrant reports whether userID holds a user_service_access grant
// on any service_instance belonging to the given tenant+service combination.
func (r *UserServiceAccessRepo) HasServiceGrant(ctx context.Context, userID, tenantID, serviceID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM user_service_access usa
			JOIN service_instances si ON si.id = usa.service_instance_id
			JOIN tenant_services ts   ON ts.id = si.tenant_service_id
			WHERE usa.user_id = $1 AND ts.tenant_id = $2 AND ts.service_id = $3
		)
	`, userID, tenantID, serviceID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("has service grant: %w", err)
	}
	return exists, nil
}

// serviceAccessGrantSelect is the shared column list/join shape used by
// getGrant and ListGrantsByUser to build a domain.ServiceAccessGrant with
// its readable service/instance/role names.
const serviceAccessGrantSelect = `
	SELECT usa.id, usa.user_id, usa.service_instance_id, si.name,
	       s.id, s.name, usa.role_id, r.name, usa.created_at
	FROM user_service_access usa
	JOIN service_instances si ON si.id = usa.service_instance_id
	JOIN tenant_services ts   ON ts.id = si.tenant_service_id
	JOIN services s           ON s.id = ts.service_id
	JOIN roles r              ON r.id = usa.role_id
`

func scanServiceAccessGrant(row rowScanner) (*domain.ServiceAccessGrant, error) {
	var g domain.ServiceAccessGrant
	if err := row.Scan(
		&g.ID, &g.UserID, &g.ServiceInstanceID, &g.ServiceInstanceName,
		&g.ServiceID, &g.ServiceName, &g.RoleID, &g.RoleName, &g.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &g, nil
}

// CreateGrant inserts a user_service_access row. It does not validate that
// roleID belongs to serviceInstanceID's service itself — the DB trigger
// enforce_role_service_match (migration 031) does that and raises a
// Postgres error (SQLSTATE P0001) that the handler maps to a 400. The
// underlying error is intentionally wrapped with %w (not swallowed) so
// errors.As still finds the *pgconn.PgError up the chain.
func (r *UserServiceAccessRepo) CreateGrant(ctx context.Context, userID, serviceInstanceID, roleID uuid.UUID) (*domain.ServiceAccessGrant, error) {
	var grantID uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO user_service_access (user_id, service_instance_id, role_id)
		VALUES ($1, $2, $3)
		RETURNING id
	`, userID, serviceInstanceID, roleID).Scan(&grantID)
	if err != nil {
		return nil, fmt.Errorf("create grant: %w", err)
	}
	return r.getGrant(ctx, grantID)
}

func (r *UserServiceAccessRepo) getGrant(ctx context.Context, id uuid.UUID) (*domain.ServiceAccessGrant, error) {
	row := r.db.QueryRow(ctx, serviceAccessGrantSelect+`WHERE usa.id = $1`, id)
	g, err := scanServiceAccessGrant(row)
	if err != nil {
		return nil, fmt.Errorf("get grant: %w", err)
	}
	return g, nil
}

// ListGrantsByUser returns every grant held by userID, enriched with
// readable service/instance/role names for the admin UI's grant panel.
func (r *UserServiceAccessRepo) ListGrantsByUser(ctx context.Context, userID uuid.UUID) ([]*domain.ServiceAccessGrant, error) {
	rows, err := r.db.Query(ctx, serviceAccessGrantSelect+`
		WHERE usa.user_id = $1
		ORDER BY s.name, si.name
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list grants by user: %w", err)
	}
	defer rows.Close()

	var grants []*domain.ServiceAccessGrant
	for rows.Next() {
		g, err := scanServiceAccessGrant(rows)
		if err != nil {
			return nil, fmt.Errorf("scan grant: %w", err)
		}
		grants = append(grants, g)
	}
	return grants, rows.Err()
}

// DeleteGrant removes grant grantID, scoped to userID.
func (r *UserServiceAccessRepo) DeleteGrant(ctx context.Context, userID, grantID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM user_service_access WHERE id = $1 AND user_id = $2`, grantID, userID)
	if err != nil {
		return fmt.Errorf("delete grant: %w", err)
	}
	return nil
}
