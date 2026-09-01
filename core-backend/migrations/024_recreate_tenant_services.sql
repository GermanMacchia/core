-- +goose Up

-- Revives tenant_services (dropped in 017_merge_tenant_services_to_portal_services)
-- as a pure adhesion/billing concern: "tenant X is subscribed to service Y",
-- independent of any portal. Delivery (which portal(s) surface it) is a
-- separate concern layered on top in later migrations of this stage.
CREATE TABLE tenant_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, service_id)
);

CREATE INDEX idx_tenant_services_tenant  ON tenant_services(tenant_id);
CREATE INDEX idx_tenant_services_service ON tenant_services(service_id);

-- +goose Down
DROP TABLE tenant_services;
