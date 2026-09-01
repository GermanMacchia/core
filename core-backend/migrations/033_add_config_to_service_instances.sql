-- +goose Up
ALTER TABLE service_instances ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- +goose Down
ALTER TABLE service_instances DROP COLUMN config;
