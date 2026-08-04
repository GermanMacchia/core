-- +goose Up
ALTER TABLE tenant_services ADD COLUMN slug VARCHAR(100);
UPDATE tenant_services ts SET slug = s.slug FROM services s WHERE s.id = ts.service_id;
ALTER TABLE tenant_services ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX idx_tenant_services_tenant_slug ON tenant_services(tenant_id, slug);
ALTER TABLE services DROP COLUMN slug;

-- +goose Down
ALTER TABLE services ADD COLUMN slug VARCHAR(100);
UPDATE services s SET slug = (SELECT ts.slug FROM tenant_services ts WHERE ts.service_id = s.id LIMIT 1);
ALTER TABLE services ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX services_slug_key ON services(slug);
DROP INDEX IF EXISTS idx_tenant_services_tenant_slug;
ALTER TABLE tenant_services DROP COLUMN slug;
