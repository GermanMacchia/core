-- +goose Up
ALTER TABLE users ADD COLUMN restrict_services BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE users DROP COLUMN restrict_services;
