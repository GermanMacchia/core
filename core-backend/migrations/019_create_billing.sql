-- +goose Up
CREATE TABLE billing_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id       UUID        NOT NULL REFERENCES plans(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled')),
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly'
                CHECK (billing_cycle IN ('monthly', 'annual')),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_subscriptions_tenant ON billing_subscriptions(tenant_id);
CREATE INDEX idx_billing_subscriptions_status ON billing_subscriptions(status);

CREATE TABLE billing_line_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID          NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
  type            VARCHAR(10)   NOT NULL
                  CHECK (type IN ('plan', 'portal', 'service')),
  ref_id          UUID          NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  quantity        INT           NOT NULL DEFAULT 1,
  period_start    TIMESTAMPTZ   NOT NULL,
  period_end      TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_line_items_subscription ON billing_line_items(subscription_id);

-- +goose Down
DROP TABLE billing_line_items;
DROP TABLE billing_subscriptions;
