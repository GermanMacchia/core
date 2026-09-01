-- +goose Up

-- Repoint the existing superadmin role into the Manager (core-admin) service's
-- own namespace, keeping its fixed UUID so any code still resolving it by ID
-- during the transition (e.g. GetByEmailGlobal) keeps working unchanged.
UPDATE roles SET service_id = '00000000-0000-0000-0000-000000000010'
WHERE id = '00000000-0000-0000-0000-000000000101';

-- Clone admin/member/viewer once per distinct service currently adhered to by
-- any tenant, so each service gets its own independent role catalog instead
-- of sharing the one global tier.
INSERT INTO roles (name, description, service_id)
SELECT r.name, r.description, ts.service_id
FROM (SELECT DISTINCT service_id FROM tenant_services) ts
CROSS JOIN (
  SELECT name, description FROM roles
  WHERE service_id IS NULL AND name IN ('admin', 'member', 'viewer')
) r
ON CONFLICT (service_id, name) DO NOTHING;

-- Seed an internal admin tier under Manager's own catalog (core-admin/staff
-- access), independent of the generic per-adhesion clone above.
INSERT INTO roles (name, description, service_id)
VALUES ('admin', 'Administrador interno de la plataforma (core-manager)', '00000000-0000-0000-0000-000000000010')
ON CONFLICT (service_id, name) DO NOTHING;

-- +goose Down

-- Remove every cloned/seeded per-service role except the repointed superadmin
-- row (whose fixed UUID must survive), then null its service_id back out.
DELETE FROM roles WHERE service_id IS NOT NULL AND id != '00000000-0000-0000-0000-000000000101';
UPDATE roles SET service_id = NULL WHERE id = '00000000-0000-0000-0000-000000000101';
