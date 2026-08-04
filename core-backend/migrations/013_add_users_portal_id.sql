-- +goose Up
ALTER TABLE users ADD COLUMN portal_id UUID REFERENCES tenant_portals(id) ON DELETE SET NULL;
CREATE INDEX idx_users_portal ON users(portal_id);

-- +goose Down
DROP INDEX IF EXISTS idx_users_portal;
ALTER TABLE users DROP COLUMN IF EXISTS portal_id;
