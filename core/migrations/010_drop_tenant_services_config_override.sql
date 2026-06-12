-- +migrate Up
ALTER TABLE tenant_services DROP COLUMN IF EXISTS config_override;

-- +migrate Down
ALTER TABLE tenant_services ADD COLUMN config_override JSONB NOT NULL DEFAULT '{}';
