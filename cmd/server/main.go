package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dariomendez/poketools/internal/api"
	"github.com/dariomendez/poketools/internal/auth"
	"github.com/dariomendez/poketools/internal/card"
	"github.com/dariomendez/poketools/internal/config"
	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/repository"
	sqlitedb "github.com/dariomendez/poketools/internal/repository/sqlite"
	"github.com/dariomendez/poketools/internal/server"
	"github.com/dariomendez/poketools/internal/version"
	"github.com/dariomendez/poketools/pkg/tcgdex"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()
	slog.Info("starting poketools", "version", version.String(), "env", cfg.Env)

	// ── Database ─────────────────────────────────────────────────────────────
	db, err := repository.Open(cfg.DatabasePath)
	if err != nil {
		slog.Error("failed to open database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := repository.Migrate(db, logger); err != nil {
		slog.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}

	// ── Repositories & Services ───────────────────────────────────────────────
	authSvc := auth.NewService(sqlitedb.NewUserRepository(db))
	authHandler := api.NewAuthHandler(authSvc, cfg.AllowSignup, cfg.IsDevelopment())

	deckRepo := sqlitedb.NewDeckRepository(db)
	deckSvc := deck.NewService(deckRepo)
	deckHandler := api.NewDeckHandler(deckSvc)

	tcgdexClient := tcgdex.New()
	cardSvc := card.NewService(tcgdexClient)
	cardHandler := api.NewCardHandler(cardSvc)

	// ── HTTP Server ───────────────────────────────────────────────────────────
	router := server.NewRouter(authSvc, authHandler, deckHandler, cardHandler)
	srv := server.New(":"+cfg.Port, router)

	// ── Background jobs ───────────────────────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go cleanupSessions(ctx, authSvc)

	// Graceful shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-quit
	cancel()
	if err := srv.Shutdown(context.Background()); err != nil {
		slog.Error("shutdown error", "err", err)
	}
}

// cleanupSessions deletes expired sessions at startup and then hourly.
// Authenticate already rejects them; this only stops the table growing.
func cleanupSessions(ctx context.Context, svc *auth.Service) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if n, err := svc.DeleteExpiredSessions(ctx); err != nil {
			slog.Error("delete expired sessions", "err", err)
		} else if n > 0 {
			slog.Info("deleted expired sessions", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
