-- +goose Up

-- A "negocio": one concrete, independently named/slugged operating instance
-- of a service a tenant has adhered to. Today's reality is strictly 1:1 with
-- tenant_services (enforced by the backfill in cmd/backfill-instances), but
-- the schema allows N per adhesion going forward.
CREATE TABLE service_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_service_id UUID NOT NULL REFERENCES tenant_services(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_service_id, slug)
);

CREATE INDEX idx_service_instances_tenant_service ON service_instances(tenant_service_id);

-- +goose Down
DROP TABLE service_instances;
