-- +goose Up

-- Phase 2 of the "service instance" -> "business" (negocio) rename: the table,
-- its referencing columns, and every constraint/index whose name carries the
-- old term are renamed so the schema matches the domain language. Constraint
-- and index names below are the Postgres defaults produced by migrations
-- 025/031/035 (plus the explicit names given there).
ALTER TABLE service_instances RENAME TO businesses;

ALTER TABLE businesses RENAME CONSTRAINT service_instances_pkey TO businesses_pkey;
ALTER TABLE businesses RENAME CONSTRAINT service_instances_tenant_service_id_fkey TO businesses_tenant_service_id_fkey;
ALTER TABLE businesses RENAME CONSTRAINT service_instances_tenant_service_fk TO businesses_tenant_service_fk;
ALTER TABLE businesses RENAME CONSTRAINT service_instances_service_id_slug_key TO businesses_service_id_slug_key;
ALTER TABLE businesses RENAME CONSTRAINT service_instances_status_check TO businesses_status_check;
ALTER INDEX idx_service_instances_tenant_service RENAME TO idx_businesses_tenant_service;

ALTER TABLE services RENAME COLUMN requires_instance TO requires_business;

ALTER TABLE user_service_access RENAME COLUMN service_instance_id TO business_id;
ALTER TABLE user_service_access
  RENAME CONSTRAINT user_service_access_service_instance_id_fkey TO user_service_access_business_id_fkey;
ALTER TABLE user_service_access
  RENAME CONSTRAINT user_service_access_user_id_service_instance_id_key TO user_service_access_user_id_business_id_key;
ALTER INDEX idx_user_service_access_service_instance RENAME TO idx_user_service_access_business;

-- The trigger trg_enforce_role_service_match keeps pointing at this function;
-- only its body changes to the new table/column names.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION enforce_role_service_match() RETURNS TRIGGER AS $$
DECLARE
  business_service_id UUID;
  role_service_id     UUID;
BEGIN
  SELECT ts.service_id INTO business_service_id
  FROM businesses b
  JOIN tenant_services ts ON ts.id = b.tenant_service_id
  WHERE b.id = NEW.business_id;

  IF business_service_id IS NULL THEN
    RAISE EXCEPTION 'user_service_access: unknown business_id %', NEW.business_id;
  END IF;

  SELECT r.service_id INTO role_service_id
  FROM roles r
  WHERE r.id = NEW.role_id;

  IF role_service_id IS NULL OR role_service_id != business_service_id THEN
    RAISE EXCEPTION 'user_service_access: role % (service_id=%) does not match business % (service_id=%)',
      NEW.role_id, role_service_id, NEW.business_id, business_service_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose Down

-- Restore the original function body from migration 031 first, so the trigger
-- never references columns that are about to be renamed back.
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

ALTER INDEX idx_user_service_access_business RENAME TO idx_user_service_access_service_instance;
ALTER TABLE user_service_access
  RENAME CONSTRAINT user_service_access_user_id_business_id_key TO user_service_access_user_id_service_instance_id_key;
ALTER TABLE user_service_access
  RENAME CONSTRAINT user_service_access_business_id_fkey TO user_service_access_service_instance_id_fkey;
ALTER TABLE user_service_access RENAME COLUMN business_id TO service_instance_id;

ALTER TABLE services RENAME COLUMN requires_business TO requires_instance;

ALTER INDEX idx_businesses_tenant_service RENAME TO idx_service_instances_tenant_service;
ALTER TABLE businesses RENAME CONSTRAINT businesses_status_check TO service_instances_status_check;
ALTER TABLE businesses RENAME CONSTRAINT businesses_service_id_slug_key TO service_instances_service_id_slug_key;
ALTER TABLE businesses RENAME CONSTRAINT businesses_tenant_service_fk TO service_instances_tenant_service_fk;
ALTER TABLE businesses RENAME CONSTRAINT businesses_tenant_service_id_fkey TO service_instances_tenant_service_id_fkey;
ALTER TABLE businesses RENAME CONSTRAINT businesses_pkey TO service_instances_pkey;

ALTER TABLE businesses RENAME TO service_instances;
