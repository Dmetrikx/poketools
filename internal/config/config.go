package config

import (
	"os"
)

type Config struct {
	Port         string
	DatabasePath string
	Env          string
	// AllowSignup gates POST /api/auth/signup. Set ALLOW_SIGNUP=false to
	// close registration without a code change.
	AllowSignup bool
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "poketools.db"),
		Env:          getEnv("ENV", "development"),
		AllowSignup:  getEnv("ALLOW_SIGNUP", "true") != "false",
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
