-- +migrate Up
ALTER TABLE config_definitions DROP CONSTRAINT IF EXISTS config_definitions_scope_check;
ALTER TABLE config_definitions ADD CONSTRAINT config_definitions_scope_check CHECK (scope IN ('service', 'portal', 'tenant', 'plan'));

-- +migrate Down
ALTER TABLE config_definitions DROP CONSTRAINT IF EXISTS config_definitions_scope_check;
ALTER TABLE config_definitions ADD CONSTRAINT config_definitions_scope_check CHECK (scope IN ('service', 'portal', 'tenant'));
