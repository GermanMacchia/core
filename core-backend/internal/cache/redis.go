package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/tu-org/core-backend/internal/config"
)

const (
	TTLTenantConfig   = 5 * time.Minute
	TTLTenantServices = 5 * time.Minute
	TTLRateLimit      = 1 * time.Minute
)

type Cache struct {
	client *redis.Client
}

func New(cfg config.RedisConfig) (*Cache, error) {
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: cfg.Password,
		DB:       0,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return &Cache{client: rdb}, nil
}

func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, b, ttl).Err()
}

func (c *Cache) Get(ctx context.Context, key string, dest any) error {
	b, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dest)
}

func (c *Cache) Del(ctx context.Context, keys ...string) error {
	return c.client.Del(ctx, keys...).Err()
}

func (c *Cache) Exists(ctx context.Context, key string) (bool, error) {
	n, err := c.client.Exists(ctx, key).Result()
	return n > 0, err
}

func (c *Cache) SetNX(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return c.client.SetNX(ctx, key, 1, ttl).Result()
}

func (c *Cache) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	pipe := c.client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

// FlushDB clears the Redis cache database
func (c *Cache) FlushDB(ctx context.Context) error {
	return c.client.FlushDB(ctx).Err()
}


func TenantKey(id string) string          { return fmt.Sprintf("tenant:%s", id) }
func TenantDomainKey(domain string) string { return fmt.Sprintf("tenant:domain:%s", domain) }
func TenantServicesKey(id string) string  { return fmt.Sprintf("tenant:%s:services", id) }
func TokenBlacklistKey(jti string) string { return fmt.Sprintf("token:blacklist:%s", jti) }
func RateLimitKey(ip, endpoint string) string {
	return fmt.Sprintf("ratelimit:%s:%s", ip, endpoint)
}
