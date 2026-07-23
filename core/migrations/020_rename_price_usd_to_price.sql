-- +migrate Up
ALTER TABLE plans RENAME COLUMN price_usd TO price;

-- +migrate Down
ALTER TABLE plans RENAME COLUMN price TO price_usd;
