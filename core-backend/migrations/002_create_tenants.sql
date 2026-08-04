-- +goose Up
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(255) UNIQUE,
  plan_id       UUID NOT NULL REFERENCES plans(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  config        JSONB NOT NULL DEFAULT '{}',
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug   ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_status ON tenants(status);

-- +goose Down
DROP TABLE tenants;
