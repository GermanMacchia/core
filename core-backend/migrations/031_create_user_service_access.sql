-- +goose Up

CREATE TABLE user_service_access (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_instance_id UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  role_id             UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, service_instance_id)
);

CREATE INDEX idx_user_service_access_user             ON user_service_access(user_id);
CREATE INDEX idx_user_service_access_service_instance ON user_service_access(service_instance_id);

-- DB-level enforcement of the namespace-separation role ceiling: a grant's
-- role must belong to the same service as the instance being granted. This is
-- not just an app-layer check — it holds even if a future bug in application
-- code tries to grant a cross-service role.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION enforce_role_service_match() RETURNS TRIGGER AS $$
DECLARE
  instance_service_id UUID;
  role_service_id     UUID;
BEGIN
  SELECT ts.service_id INTO instance_service_id
  FROM service_instances si
  JOIN tenant_services ts ON ts.id = si.tenant_service_id
  WHERE si.id = NEW.service_instance_id;

  IF instance_service_id IS NULL THEN
    RAISE EXCEPTION 'user_service_access: unknown service_instance_id %', NEW.service_instance_id;
  END IF;

  SELECT r.service_id INTO role_service_id
  FROM roles r
  WHERE r.id = NEW.role_id;

  IF role_service_id IS NULL OR role_service_id != instance_service_id THEN
    RAISE EXCEPTION 'user_service_access: role % (service_id=%) does not match instance % (service_id=%)',
      NEW.role_id, role_service_id, NEW.service_instance_id, instance_service_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_enforce_role_service_match
  BEFORE INSERT OR UPDATE ON user_service_access
  FOR EACH ROW
  EXECUTE FUNCTION enforce_role_service_match();

-- +goose Down
DROP TRIGGER IF EXISTS trg_enforce_role_service_match ON user_service_access;
DROP FUNCTION IF EXISTS enforce_role_service_match();
DROP TABLE user_service_access;
