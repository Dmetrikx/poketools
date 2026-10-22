package server

import (
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/dariomendez/poketools/internal/api"
	"github.com/dariomendez/poketools/internal/auth"
	webstatic "github.com/dariomendez/poketools/web"
)

// NewRouter builds and returns the application chi router.
func NewRouter(
	authSvc *auth.Service,
	authHandler *api.AuthHandler,
	deckHandler *api.DeckHandler,
	cardHandler *api.CardHandler,
) http.Handler {
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
		// Public auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/signup", authHandler.Signup)
			r.Post("/login", authHandler.Login)
			r.Post("/logout", authHandler.Logout)
			r.Get("/me", authHandler.Me)
		})

		// Everything else under /api requires a session.
		r.Group(func(r chi.Router) {
			r.Use(api.RequireAuth(authSvc))
			registerAppRoutes(r, deckHandler, cardHandler)
		})
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok")) //nolint:errcheck
	})

	// Serve embedded frontend (SPA fallback: unknown paths → index.html).
	// This MUST stay outside RequireAuth: the login page is served by it, so
	// gating it would make logging in impossible.
	dist, _ := fs.Sub(webstatic.Static, "dist")
	fileServer := http.FileServer(http.FS(dist))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path[1:] // strip leading "/"
		if path == "" {
			path = "index.html"
		}
		if _, err := dist.Open(path); err != nil {
			// Rewrite to "/" rather than "/index.html": http.FileServer
			// redirects a request for "/index.html" to "./", which on a
			// nested route like /decks/abc/practice resolves to /decks/abc/
			// and misses again, looping until the browser gives up.
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	return r
}

func registerAppRoutes(r chi.Router, deckHandler *api.DeckHandler, cardHandler *api.CardHandler) {
	// Deck routes
	r.Route("/decks", func(r chi.Router) {
		r.Get("/", deckHandler.List)
		r.Post("/", deckHandler.Create)
		r.Post("/import", deckHandler.Import)

		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", deckHandler.Get)
			r.Put("/", deckHandler.Update)
			r.Delete("/", deckHandler.Delete)
			r.Put("/covers", deckHandler.SetCovers)

			// Entry sub-routes
			r.Post("/entries", deckHandler.AddEntry)
			r.Put("/entries/{eid}", deckHandler.UpdateEntry)
			r.Put("/entries/{eid}/art", deckHandler.UpdateEntryArt)
			r.Delete("/entries/{eid}", deckHandler.DeleteEntry)
		})
	})

	// Card routes
	r.Route("/cards", func(r chi.Router) {
		r.Get("/search", cardHandler.Search)
		r.Get("/resolve", cardHandler.Resolve)
		r.Get("/{id}", cardHandler.Get)
	})
}
