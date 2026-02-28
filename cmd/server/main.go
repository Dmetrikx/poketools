package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/dariomendez/poketools/internal/api"
	"github.com/dariomendez/poketools/internal/card"
	"github.com/dariomendez/poketools/internal/config"
	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/repository"
	sqlitedb "github.com/dariomendez/poketools/internal/repository/sqlite"
	"github.com/dariomendez/poketools/internal/server"
	"github.com/dariomendez/poketools/pkg/tcgdex"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()

	// ── Database ─────────────────────────────────────────────────────────────
	db, err := repository.Open(cfg.DatabasePath)
	if err != nil {
		slog.Error("failed to open database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := repository.Migrate(db); err != nil {
		slog.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}

	// ── Repositories & Services ───────────────────────────────────────────────
	deckRepo := sqlitedb.NewDeckRepository(db)
	deckSvc := deck.NewService(deckRepo)
	deckHandler := api.NewDeckHandler(deckSvc)

	tcgdexClient := tcgdex.New()
	cardSvc := card.NewService(tcgdexClient)
	cardHandler := api.NewCardHandler(cardSvc)

	// ── HTTP Server ───────────────────────────────────────────────────────────
	router := server.NewRouter(deckHandler, cardHandler)
	srv := server.New(":"+cfg.Port, router)

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
	if err := srv.Shutdown(context.Background()); err != nil {
		slog.Error("shutdown error", "err", err)
	}
}
