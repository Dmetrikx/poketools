package config

import (
	"os"
)

type Config struct {
	Port         string
	DatabasePath string
	Env          string
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "poketools.db"),
		Env:          getEnv("ENV", "development"),
	}
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
