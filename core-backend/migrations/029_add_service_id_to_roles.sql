-- +goose Up

-- Roles become scoped per service instead of one shared global enum. Nullable
-- for now: existing rows (superadmin/admin/member/viewer) keep service_id
-- NULL until 030 repoints/clones them.
ALTER TABLE roles ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;

-- The old global UNIQUE(name) can't survive per-service cloning (030 clones
-- 'admin'/'member'/'viewer' once per service). Replace it with a composite
-- uniqueness (service_id, name) plus a partial index that preserves today's
-- invariant for the still-global rows (service_id IS NULL).
ALTER TABLE roles DROP CONSTRAINT roles_name_key;
CREATE UNIQUE INDEX idx_roles_service_id_name ON roles(service_id, name);
CREATE UNIQUE INDEX idx_roles_name_global ON roles(name) WHERE service_id IS NULL;

CREATE INDEX idx_roles_service_id ON roles(service_id);

-- +goose Down
DROP INDEX IF EXISTS idx_roles_service_id;
DROP INDEX IF EXISTS idx_roles_name_global;
DROP INDEX IF EXISTS idx_roles_service_id_name;
ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
ALTER TABLE roles DROP COLUMN service_id;
