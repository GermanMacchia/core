-- +goose Up

-- A negocio's slug is its public address inside its service (e.g. booking's
-- /public/v1/tenants/{slug}), so it must be unique per service, not per
-- tenant_services row: with one instance per adhesion, the previous
-- UNIQUE(tenant_service_id, slug) never stopped two tenants from getting the
-- same slug. A unique index can't span the tenant_services join, so service_id
-- is denormalized here and kept consistent through a composite FK.
ALTER TABLE tenant_services
  ADD CONSTRAINT tenant_services_id_service_id_key UNIQUE (id, service_id);

ALTER TABLE service_instances ADD COLUMN service_id UUID;

UPDATE service_instances si
SET service_id = ts.service_id
FROM tenant_services ts
WHERE ts.id = si.tenant_service_id;

ALTER TABLE service_instances ALTER COLUMN service_id SET NOT NULL;

ALTER TABLE service_instances
  ADD CONSTRAINT service_instances_tenant_service_fk
  FOREIGN KEY (tenant_service_id, service_id)
  REFERENCES tenant_services (id, service_id) ON DELETE CASCADE;

ALTER TABLE service_instances DROP CONSTRAINT service_instances_tenant_service_id_slug_key;
ALTER TABLE service_instances
  ADD CONSTRAINT service_instances_service_id_slug_key UNIQUE (service_id, slug);

-- +goose Down
ALTER TABLE service_instances DROP CONSTRAINT service_instances_service_id_slug_key;
ALTER TABLE service_instances
  ADD CONSTRAINT service_instances_tenant_service_id_slug_key UNIQUE (tenant_service_id, slug);
ALTER TABLE service_instances DROP CONSTRAINT service_instances_tenant_service_fk;
ALTER TABLE service_instances DROP COLUMN service_id;
ALTER TABLE tenant_services DROP CONSTRAINT tenant_services_id_service_id_key;
