-- +migrate Up
CREATE TABLE plan_service_pricing (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID          NOT NULL REFERENCES plans(id)    ON DELETE CASCADE,
  service_id  UUID          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_included BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, service_id)
);

CREATE INDEX idx_plan_service_pricing_plan    ON plan_service_pricing(plan_id);
CREATE INDEX idx_plan_service_pricing_service ON plan_service_pricing(service_id);

-- +migrate Down
DROP TABLE plan_service_pricing;
