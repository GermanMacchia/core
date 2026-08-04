-- +goose Up
ALTER TABLE tenant_services DROP COLUMN IF EXISTS config_override;

-- +goose Down
ALTER TABLE tenant_services ADD COLUMN config_override JSONB NOT NULL DEFAULT '{}';
