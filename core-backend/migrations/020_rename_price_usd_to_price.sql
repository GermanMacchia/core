-- +goose Up
ALTER TABLE plans RENAME COLUMN price_usd TO price;

-- +goose Down
ALTER TABLE plans RENAME COLUMN price TO price_usd;
