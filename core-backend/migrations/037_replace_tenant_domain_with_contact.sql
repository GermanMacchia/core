-- +goose Up
-- tenants.domain is conceptually wrong: domains belong to tenant_portals.domain
-- (UNIQUE, one per portal). Nothing resolves tenants by domain anymore, so the
-- column is replaced with account contact / billing fields.
ALTER TABLE tenants
  ADD COLUMN contact_email VARCHAR(255),
  ADD COLUMN contact_phone VARCHAR(30),
  ADD COLUMN address       TEXT,
  ADD COLUMN tax_id        VARCHAR(11);

-- Salvage values that were (mis)used as a contact email.
UPDATE tenants
SET contact_email = domain
WHERE domain ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

DROP INDEX IF EXISTS idx_tenants_domain;
-- Dropping the column also drops its UNIQUE constraint.
ALTER TABLE tenants DROP COLUMN domain;

-- +goose Down
-- Data previously stored in tenants.domain is NOT restorable: the column comes
-- back empty. Contact data (email, phone, address, tax id) is discarded.
ALTER TABLE tenants ADD COLUMN domain VARCHAR(255) UNIQUE;
CREATE INDEX idx_tenants_domain ON tenants(domain);

ALTER TABLE tenants
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS tax_id;
