-- +migrate Up
ALTER TABLE tenant_portals DROP COLUMN IF EXISTS slug;

-- +migrate Down
ALTER TABLE tenant_portals ADD COLUMN slug VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_portals_tenant_id_slug_key ON tenant_portals(tenant_id, slug);
