package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Server wraps http.Server with graceful shutdown support.
type Server struct {
	httpServer *http.Server
}

func New(addr string, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      handler,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 30 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}
}

// Start begins listening and blocks until the server is stopped.
func (s *Server) Start() error {
	slog.Info("server listening", "addr", s.httpServer.Addr)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("listen: %w", err)
	}
	return nil
}

// Shutdown gracefully stops the server, waiting up to 30 seconds for
// in-flight requests to complete.
func (s *Server) Shutdown(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	slog.Info("shutting down server")
	return s.httpServer.Shutdown(ctx)
}
