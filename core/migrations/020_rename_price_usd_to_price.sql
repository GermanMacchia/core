-- +migrate Up
ALTER TABLE plans                RENAME COLUMN price_usd TO price;
ALTER TABLE plan_service_pricing RENAME COLUMN price_usd TO price;
ALTER TABLE billing_line_items   RENAME COLUMN price_usd TO price;

-- +migrate Down
ALTER TABLE billing_line_items   RENAME COLUMN price TO price_usd;
ALTER TABLE plan_service_pricing RENAME COLUMN price TO price_usd;
ALTER TABLE plans                RENAME COLUMN price TO price_usd;
