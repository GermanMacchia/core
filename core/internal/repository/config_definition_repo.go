package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/tenant-core/internal/domain"
)

var _ domain.ConfigDefinitionRepository = (*ConfigDefinitionRepo)(nil)

type ConfigDefinitionRepo struct {
	db *pgxpool.Pool
}

func NewConfigDefinitionRepo(db *pgxpool.Pool) *ConfigDefinitionRepo {
	return &ConfigDefinitionRepo{db: db}
}

func (r *ConfigDefinitionRepo) Create(ctx context.Context, input domain.CreateConfigDefinitionInput) (*domain.ConfigDefinition, error) {
	var cd domain.ConfigDefinition
	err := r.db.QueryRow(ctx, `
		INSERT INTO config_definitions (key, scope, type, description, default_val)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING key, scope, type, description, default_val
	`, input.Key, input.Scope, input.Type, input.Description, input.DefaultVal).
		Scan(&cd.Key, &cd.Scope, &cd.Type, &cd.Description, &cd.DefaultVal)
	if err != nil {
		return nil, fmt.Errorf("create config definition: %w", err)
	}
	return &cd, nil
}

func (r *ConfigDefinitionRepo) Get(ctx context.Context, scope string, key string) (*domain.ConfigDefinition, error) {
	var cd domain.ConfigDefinition
	err := r.db.QueryRow(ctx, `
		SELECT key, scope, type, description, default_val
		FROM config_definitions
		WHERE scope = $1 AND key = $2
	`, scope, key).Scan(&cd.Key, &cd.Scope, &cd.Type, &cd.Description, &cd.DefaultVal)
	if err != nil {
		return nil, fmt.Errorf("get config definition: %w", err)
	}
	return &cd, nil
}

func (r *ConfigDefinitionRepo) List(ctx context.Context) ([]*domain.ConfigDefinition, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, scope, type, description, default_val
		FROM config_definitions
		ORDER BY scope, key
	`)
	if err != nil {
		return nil, fmt.Errorf("list config definitions: %w", err)
	}
	defer rows.Close()

	var list []*domain.ConfigDefinition
	for rows.Next() {
		var cd domain.ConfigDefinition
		if err := rows.Scan(&cd.Key, &cd.Scope, &cd.Type, &cd.Description, &cd.DefaultVal); err != nil {
			return nil, err
		}
		list = append(list, &cd)
	}
	return list, rows.Err()
}

func (r *ConfigDefinitionRepo) Update(ctx context.Context, scope string, key string, input domain.UpdateConfigDefinitionInput) (*domain.ConfigDefinition, error) {
	var cd domain.ConfigDefinition
	err := r.db.QueryRow(ctx, `
		UPDATE config_definitions SET
			type        = COALESCE($3, type),
			description = COALESCE($4, description),
			default_val = COALESCE($5, default_val)
		WHERE scope = $1 AND key = $2
		RETURNING key, scope, type, description, default_val
	`, scope, key, input.Type, input.Description, input.DefaultVal).
		Scan(&cd.Key, &cd.Scope, &cd.Type, &cd.Description, &cd.DefaultVal)
	if err != nil {
		return nil, fmt.Errorf("update config definition: %w", err)
	}
	return &cd, nil
}

func (r *ConfigDefinitionRepo) Delete(ctx context.Context, scope string, key string) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM config_definitions
		WHERE scope = $1 AND key = $2
	`, scope, key)
	if err != nil {
		return fmt.Errorf("delete config definition: %w", err)
	}
	return nil
}
