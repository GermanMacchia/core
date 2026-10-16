-- +goose Up
-- A deployment is an app deployed once by the platform, with one canonical
-- URL. A service (the commercial offering) now rests on a deployment
-- (N services : 1 deployment), so services.mfe_url / services.version move to
-- deployments.url / deployments.version. A deployment may exist without
-- services. services.is_internal is dropped: no code reads it (internal
-- access is decided by grants on the Manager service, …0010).
CREATE TABLE deployments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  url         VARCHAR(500) NOT NULL,
  api_url     VARCHAR(500),
  version     VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill one deployment per distinct services.mfe_url. The group holding
-- Manager (…0010) or Login (…0011) gets the fixed id/name the seed uses
-- (core-manager …0020, core-login …0021) and is processed first so those
-- names win. Other groups take name/version from their first service by
-- name. Names are suffixed with the deployment's short id on collision so the
-- result is deterministic per id.
-- +goose StatementBegin
DO $$
DECLARE
  rec       RECORD;
  dep_id    UUID;
  dep_name  TEXT;
  short_id  TEXT;
BEGIN
  FOR rec IN
    SELECT * FROM (
      SELECT DISTINCT ON (s.mfe_url)
             s.mfe_url, s.name, s.version,
             bool_or(s.id = '00000000-0000-0000-0000-000000000010') OVER (PARTITION BY s.mfe_url) AS has_manager,
             bool_or(s.id = '00000000-0000-0000-0000-000000000011') OVER (PARTITION BY s.mfe_url) AS has_login
      FROM services s
      ORDER BY s.mfe_url,
               (s.id = '00000000-0000-0000-0000-000000000010') DESC,
               (s.id = '00000000-0000-0000-0000-000000000011') DESC,
               s.name
    ) g
    ORDER BY g.has_manager DESC, g.has_login DESC, g.name
  LOOP
    IF rec.has_manager THEN
      dep_id   := '00000000-0000-0000-0000-000000000020';
      dep_name := 'core-manager';
    ELSIF rec.has_login THEN
      dep_id   := '00000000-0000-0000-0000-000000000021';
      dep_name := 'core-login';
    ELSE
      dep_id   := gen_random_uuid();
      dep_name := rec.name;
    END IF;
    short_id := left(replace(dep_id::text, '-', ''), 8);

    IF EXISTS (SELECT 1 FROM deployments WHERE name = dep_name) THEN
      dep_name := left(dep_name, 90) || '-' || short_id;
    END IF;

    INSERT INTO deployments (id, name, url, version)
    VALUES (dep_id, dep_name, rec.mfe_url, rec.version);
  END LOOP;
END
$$;
-- +goose StatementEnd

ALTER TABLE services ADD COLUMN deployment_id UUID REFERENCES deployments(id) ON DELETE RESTRICT;

UPDATE services s SET deployment_id = d.id
FROM deployments d
WHERE d.url = s.mfe_url;

ALTER TABLE services ALTER COLUMN deployment_id SET NOT NULL;
CREATE INDEX idx_services_deployment_id ON services(deployment_id);

ALTER TABLE services DROP COLUMN mfe_url;
ALTER TABLE services DROP COLUMN version;
ALTER TABLE services DROP COLUMN is_internal;

-- +goose Down
-- Deployments without services are lost on rollback: they have no column to
-- be folded back into.
ALTER TABLE services ADD COLUMN mfe_url VARCHAR(500);
ALTER TABLE services ADD COLUMN version VARCHAR(20) NOT NULL DEFAULT '1.0.0';
ALTER TABLE services ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE services s SET mfe_url = d.url, version = d.version
FROM deployments d
WHERE d.id = s.deployment_id;

-- Manager (core-manager) is platform/staff-only (see migration 023).
UPDATE services SET is_internal = TRUE WHERE id = '00000000-0000-0000-0000-000000000010';

ALTER TABLE services ALTER COLUMN mfe_url SET NOT NULL;

DROP INDEX IF EXISTS idx_services_deployment_id;
ALTER TABLE services DROP COLUMN deployment_id;
DROP TABLE deployments;
