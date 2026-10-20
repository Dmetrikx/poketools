package api

import (
	"net/http"

	"github.com/dariomendez/poketools/internal/auth"
)

// RequireAuth is chi middleware that rejects requests without a valid
// session cookie, and stores the session's user in the request context.
func RequireAuth(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(sessionCookieName)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			u, err := svc.Authenticate(r.Context(), c.Value)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithUser(r.Context(), u)))
		})
	}
}

// userID returns the authenticated user's ID. Handlers behind RequireAuth
// always have one; elsewhere it is "", which matches no deck.
func userID(r *http.Request) string {
	if u, ok := auth.UserFrom(r.Context()); ok {
		return u.ID
	}
	return ""
}
