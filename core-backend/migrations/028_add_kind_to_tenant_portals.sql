-- +goose Up

-- 'admin' (internal/staff-facing, e.g. booking-admin, core-manager) vs
-- 'public' (customer-facing). All existing rows are today's only real usage
-- (login-gated staff portals), so they backfill to 'admin' — zero-risk
-- default, no existing row changes meaning.
ALTER TABLE tenant_portals ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (kind IN ('admin', 'public'));

-- +goose Down
ALTER TABLE tenant_portals DROP COLUMN kind;
