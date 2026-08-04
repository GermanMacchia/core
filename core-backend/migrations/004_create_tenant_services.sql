-- +goose Up
CREATE TABLE tenant_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  config_override JSONB NOT NULL DEFAULT '{}',
  enabled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, service_id)
);

CREATE INDEX idx_tenant_services_tenant ON tenant_services(tenant_id);

-- +goose Down
DROP TABLE tenant_services;
