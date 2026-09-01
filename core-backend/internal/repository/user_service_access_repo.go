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
