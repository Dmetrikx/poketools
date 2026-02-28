package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/dariomendez/poketools/internal/api"
)

// NewRouter builds and returns the application chi router.
func NewRouter(deckHandler *api.DeckHandler, cardHandler *api.CardHandler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:8080"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
	}))

	r.Route("/api", func(r chi.Router) {
		// Deck routes
		r.Route("/decks", func(r chi.Router) {
			r.Get("/", deckHandler.List)
			r.Post("/", deckHandler.Create)
			r.Post("/import", deckHandler.Import)

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", deckHandler.Get)
				r.Put("/", deckHandler.Update)
				r.Delete("/", deckHandler.Delete)
				r.Get("/export", deckHandler.Export)

				// Entry sub-routes
				r.Post("/entries", deckHandler.AddEntry)
				r.Put("/entries/{eid}", deckHandler.UpdateEntry)
				r.Delete("/entries/{eid}", deckHandler.DeleteEntry)
			})
		})

		// Card routes
		r.Route("/cards", func(r chi.Router) {
			r.Get("/search", cardHandler.Search)
			r.Get("/{id}", cardHandler.Get)
		})
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok")) //nolint:errcheck
	})

	return r
}
