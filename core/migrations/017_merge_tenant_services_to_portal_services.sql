-- +migrate Up

-- Unified portal-level service assignments (merges tenant_services + portal_services)
CREATE TABLE portal_services_new (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID        NOT NULL REFERENCES tenant_portals(id) ON DELETE CASCADE,
  service_id      UUID        NOT NULL REFERENCES services(id)       ON DELETE CASCADE,
  slug            VARCHAR(100) NOT NULL,
  sort_order      INT          NOT NULL DEFAULT 0,
  is_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
  config_override JSONB        NOT NULL DEFAULT '{}',
  enabled_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, service_id),
  UNIQUE(portal_id, slug)
);

INSERT INTO portal_services_new
  (portal_id, service_id, slug, sort_order, is_enabled, config_override, enabled_at, expires_at)
SELECT
  ps.portal_id,
  ts.service_id,
  ts.slug,
  ps.sort_order,
  ps.is_enabled AND ts.is_enabled,
  ps.config_override,
  ts.enabled_at,
  ts.expires_at
FROM portal_services ps
JOIN tenant_services ts ON ts.id = ps.tenant_service_id;

DROP TABLE portal_services;
DROP TABLE tenant_services;

ALTER TABLE portal_services_new RENAME TO portal_services;

CREATE INDEX idx_portal_services_portal  ON portal_services(portal_id);
CREATE INDEX idx_portal_services_service ON portal_services(service_id);

-- +migrate Down

CREATE TABLE tenant_services (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  service_id UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slug       VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
  enabled_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, service_id)
);
CREATE INDEX idx_tenant_services_tenant      ON tenant_services(tenant_id);
CREATE UNIQUE INDEX idx_tenant_services_tenant_slug ON tenant_services(tenant_id, slug);

INSERT INTO tenant_services (tenant_id, service_id, slug, is_enabled, enabled_at, expires_at)
SELECT DISTINCT ON (p.tenant_id, ps.service_id)
  p.tenant_id, ps.service_id, ps.slug, ps.is_enabled, ps.enabled_at, ps.expires_at
FROM portal_services ps
JOIN tenant_portals p ON p.id = ps.portal_id
ORDER BY p.tenant_id, ps.service_id, ps.enabled_at;

CREATE TABLE portal_services_old (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id         UUID NOT NULL REFERENCES tenant_portals(id)  ON DELETE CASCADE,
  tenant_service_id UUID NOT NULL REFERENCES tenant_services(id) ON DELETE CASCADE,
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  config_override   JSONB   NOT NULL DEFAULT '{}',
  sort_order        INT     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, tenant_service_id)
);
CREATE INDEX idx_portal_services_portal_old ON portal_services_old(portal_id);

INSERT INTO portal_services_old (portal_id, tenant_service_id, is_enabled, config_override, sort_order)
SELECT
  ps.portal_id,
  ts.id,
  ps.is_enabled,
  ps.config_override,
  ps.sort_order
FROM portal_services ps
JOIN tenant_portals  p  ON p.id = ps.portal_id
JOIN tenant_services ts ON ts.service_id = ps.service_id AND ts.tenant_id = p.tenant_id;

DROP TABLE portal_services;
ALTER TABLE portal_services_old RENAME TO portal_services;
