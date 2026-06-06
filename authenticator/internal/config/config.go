package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Env  string
	Port string

	DB    DBConfig
	Redis RedisConfig
	JWT   JWTConfig
	CORS  CORSConfig
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
	Secret         string
	ExpMinutes     int
	RefreshExpDays int
}

type CORSConfig struct {
	AllowedOrigins []string
}

func Load() (*Config, error) {
	viper.AutomaticEnv()
	viper.SetConfigFile(".env")
	viper.SetConfigType("env")
	_ = viper.ReadInConfig()

	viper.SetDefault("ENV", "development")
	viper.SetDefault("PORT", "8081")
	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("DB_NAME", "core_db")
	viper.SetDefault("DB_USER", "core_user")
	viper.SetDefault("DB_MAX_CONNS", 10)
	viper.SetDefault("REDIS_HOST", "localhost")
	viper.SetDefault("REDIS_PORT", "6379")
	viper.SetDefault("JWT_EXP_MINUTES", 15)
	viper.SetDefault("REFRESH_TOKEN_EXP_DAYS", 30)

	return &Config{
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
			Secret:         viper.GetString("JWT_SECRET"),
			ExpMinutes:     viper.GetInt("JWT_EXP_MINUTES"),
			RefreshExpDays: viper.GetInt("REFRESH_TOKEN_EXP_DAYS"),
		},
		CORS: CORSConfig{
			AllowedOrigins: strings.Split(viper.GetString("ALLOWED_ORIGINS"), ","),
		},
	}, nil
}

func (j *JWTConfig) AccessTokenDuration() time.Duration {
	return time.Duration(j.ExpMinutes) * time.Minute
}

func (j *JWTConfig) RefreshTokenDuration() time.Duration {
	return time.Duration(j.RefreshExpDays) * 24 * time.Hour
}
