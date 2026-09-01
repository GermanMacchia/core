-- +goose Up

-- Nullable alongside the existing service_id: dual-read/dual-write window
-- through Stage B. Backfilled from tenant_services (populated by
-- cmd/backfill-instances, which MUST have already run against this database
-- by the time this migration is applied).
ALTER TABLE portal_services ADD COLUMN tenant_service_id UUID REFERENCES tenant_services(id) ON DELETE CASCADE;

UPDATE portal_services ps
SET tenant_service_id = ts.id
FROM tenant_portals p, tenant_services ts
WHERE p.id = ps.portal_id
  AND ts.tenant_id = p.tenant_id
  AND ts.service_id = ps.service_id
  AND ps.tenant_service_id IS NULL;

CREATE INDEX idx_portal_services_tenant_service ON portal_services(tenant_service_id);

-- +goose Down
DROP INDEX IF EXISTS idx_portal_services_tenant_service;
ALTER TABLE portal_services DROP COLUMN IF EXISTS tenant_service_id;
