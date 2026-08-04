-- +goose Up
CREATE TABLE plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL UNIQUE,
  max_users    INT NOT NULL DEFAULT 5,
  max_services INT NOT NULL DEFAULT 3,
  price_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  features     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, max_users, max_services, price_usd) VALUES
  ('free',       5,   3,   0.00),
  ('starter',    25,  10,  29.00),
  ('pro',        100, 25,  99.00),
  ('enterprise', -1,  -1,  499.00);

-- +goose Down
DROP TABLE plans;
