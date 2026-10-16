package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

// Compile-time check that DeploymentRepo satisfies the domain interface.
var _ domain.DeploymentRepository = (*DeploymentRepo)(nil)

type DeploymentRepo struct {
	db *pgxpool.Pool
}

func NewDeploymentRepo(db *pgxpool.Pool) *DeploymentRepo {
	return &DeploymentRepo{db: db}
}

const deploymentColumns = `id, name, url, api_url, version, description, is_active, created_at, updated_at`

func scanDeployment(row rowScanner) (*domain.Deployment, error) {
	var d domain.Deployment
	if err := row.Scan(
		&d.ID, &d.Name, &d.URL, &d.APIURL, &d.Version, &d.Description,
		&d.IsActive, &d.CreatedAt, &d.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DeploymentRepo) Create(ctx context.Context, input domain.CreateDeploymentInput) (*domain.Deployment, error) {
	d, err := scanDeployment(r.db.QueryRow(ctx, `
		INSERT INTO deployments (name, url, api_url, version, description)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+deploymentColumns,
		input.Name, input.URL, input.APIURL, input.Version, input.Description))
	if err != nil {
		return nil, fmt.Errorf("create deployment: %w", err)
	}
	return d, nil
}

func (r *DeploymentRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Deployment, error) {
	d, err := scanDeployment(r.db.QueryRow(ctx, `SELECT `+deploymentColumns+` FROM deployments WHERE id = $1`, id))
	if err != nil {
		return nil, fmt.Errorf("get deployment by id: %w", err)
	}
	return d, nil
}

func (r *DeploymentRepo) List(ctx context.Context, onlyActive bool) ([]*domain.Deployment, error) {
	q := `SELECT ` + deploymentColumns + ` FROM deployments`
	if onlyActive {
		q += ` WHERE is_active = TRUE`
	}
	q += ` ORDER BY name`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list deployments: %w", err)
	}
	defer rows.Close()

	var deployments []*domain.Deployment
	for rows.Next() {
		d, err := scanDeployment(rows)
		if err != nil {
			return nil, err
		}
		deployments = append(deployments, d)
	}
	return deployments, rows.Err()
}

func (r *DeploymentRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateDeploymentInput) (*domain.Deployment, error) {
	d, err := scanDeployment(r.db.QueryRow(ctx, `
		UPDATE deployments SET
			name        = COALESCE($2, name),
			url         = COALESCE($3, url),
			api_url     = COALESCE($4, api_url),
			version     = COALESCE($5, version),
			description = COALESCE($6, description),
			is_active   = COALESCE($7, is_active),
			updated_at  = NOW()
		WHERE id = $1
		RETURNING `+deploymentColumns,
		id, input.Name, input.URL, input.APIURL, input.Version, input.Description, input.IsActive))
	if err != nil {
		return nil, fmt.Errorf("update deployment: %w", err)
	}
	return d, nil
}

// Delete hard-deletes a deployment. services.deployment_id is ON DELETE
// RESTRICT, so a deployment still referenced by any service (active or not)
// fails with SQLSTATE 23503, surfaced as domain.ErrDeploymentInUse.
func (r *DeploymentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM deployments WHERE id = $1`, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return domain.ErrDeploymentInUse
		}
		return fmt.Errorf("delete deployment: %w", err)
	}
	return nil
}
