-- +goose Up
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(100),
  resource_id UUID,
  payload     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);

-- +goose Down
DROP TABLE audit_logs;
