-- +goose Up
CREATE TABLE tenant_portals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug        VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  domain      VARCHAR(255),
  description TEXT,
  config      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug),
  UNIQUE(domain)
);

CREATE INDEX idx_tenant_portals_tenant ON tenant_portals(tenant_id);
CREATE INDEX idx_tenant_portals_domain ON tenant_portals(domain);

CREATE TABLE portal_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id         UUID NOT NULL REFERENCES tenant_portals(id) ON DELETE CASCADE,
  tenant_service_id UUID NOT NULL REFERENCES tenant_services(id) ON DELETE CASCADE,
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  config_override   JSONB NOT NULL DEFAULT '{}',
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, tenant_service_id)
);

CREATE INDEX idx_portal_services_portal ON portal_services(portal_id);

-- +goose Down
DROP TABLE portal_services;
DROP TABLE tenant_portals;
