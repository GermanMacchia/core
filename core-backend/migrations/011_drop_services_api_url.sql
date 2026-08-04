-- +goose Up
ALTER TABLE services DROP COLUMN IF EXISTS api_url;

-- +goose Down
ALTER TABLE services ADD COLUMN api_url VARCHAR(500);
