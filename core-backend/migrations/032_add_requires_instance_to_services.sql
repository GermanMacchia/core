-- +goose Up
ALTER TABLE services ADD COLUMN requires_instance BOOLEAN NOT NULL DEFAULT TRUE;

-- +goose Down
ALTER TABLE services DROP COLUMN requires_instance;
