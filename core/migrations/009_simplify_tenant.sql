-- +migrate Up
ALTER TABLE tenants DROP COLUMN IF EXISTS slug;
DROP INDEX IF EXISTS idx_tenants_slug;

-- +migrate Down
ALTER TABLE tenants ADD COLUMN slug VARCHAR(100);
CREATE UNIQUE INDEX idx_tenants_slug ON tenants(slug);
