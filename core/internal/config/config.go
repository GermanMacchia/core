package config

import (
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Env  string
	Port string

	DB DBConfig

	Redis RedisConfig

	JWT JWTConfig

	CORS CORSConfig

	Seed SeedConfig
}

type DBConfig struct {
	Host     string
	Port     string
	Name     string
	User     string
	Password string
	MaxConns int32
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
}

type JWTConfig struct {
	Secret string
}

type CORSConfig struct {
	AllowedOrigins []string
}

type SeedConfig struct {
	AdminEmail    string
	AdminPassword string
}

func Load() (*Config, error) {
	viper.AutomaticEnv()
	viper.SetConfigFile(".env")
	viper.SetConfigType("env")
	_ = viper.ReadInConfig()

	viper.SetDefault("ENV", "development")
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("DB_NAME", "core_db")
	viper.SetDefault("DB_USER", "core_user")
	viper.SetDefault("DB_MAX_CONNS", 25)
	viper.SetDefault("REDIS_HOST", "localhost")
	viper.SetDefault("REDIS_PORT", "6379")

	cfg := &Config{
		Env:  viper.GetString("ENV"),
		Port: viper.GetString("PORT"),
		DB: DBConfig{
			Host:     viper.GetString("DB_HOST"),
			Port:     viper.GetString("DB_PORT"),
			Name:     viper.GetString("DB_NAME"),
			User:     viper.GetString("DB_USER"),
			Password: viper.GetString("DB_PASSWORD"),
			MaxConns: int32(viper.GetInt("DB_MAX_CONNS")),
		},
		Redis: RedisConfig{
			Host:     viper.GetString("REDIS_HOST"),
			Port:     viper.GetString("REDIS_PORT"),
			Password: viper.GetString("REDIS_PASSWORD"),
		},
		JWT: JWTConfig{
			Secret: viper.GetString("JWT_SECRET"),
		},
		CORS: CORSConfig{
			AllowedOrigins: strings.Split(viper.GetString("ALLOWED_ORIGINS"), ","),
		},
		Seed: SeedConfig{
			AdminEmail:    viper.GetString("SEED_ADMIN_EMAIL"),
			AdminPassword: viper.GetString("SEED_ADMIN_PASSWORD"),
		},
	}

	return cfg, nil
}
