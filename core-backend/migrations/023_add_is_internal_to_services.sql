-- +goose Up
ALTER TABLE services ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- Manager (core-manager) is platform/staff-only, never a tenant-facing offering.
UPDATE services SET is_internal = TRUE WHERE id = '00000000-0000-0000-0000-000000000010';

-- +goose Down
ALTER TABLE services DROP COLUMN is_internal;
