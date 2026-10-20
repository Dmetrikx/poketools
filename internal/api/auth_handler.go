package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/dariomendez/poketools/internal/auth"
)

const sessionCookieName = "poketools_session"

// failedLoginDelay slows down credential guessing. It is per request, not a
// real rate limit.
const failedLoginDelay = 500 * time.Millisecond

// AuthHandler holds HTTP handlers for signup/login/logout/session-check.
type AuthHandler struct {
	svc         *auth.Service
	allowSignup bool
	isDev       bool
}

func NewAuthHandler(svc *auth.Service, allowSignup, isDev bool) *AuthHandler {
	return &AuthHandler{svc: svc, allowSignup: allowSignup, isDev: isDev}
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Signup handles POST /api/auth/signup
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	if !h.allowSignup {
		writeError(w, http.StatusForbidden, "signups are closed")
		return
	}
	var body credentials
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	u, token, err := h.svc.Signup(r.Context(), body.Email, body.Password)
	switch {
	case errors.Is(err, auth.ErrInvalidEmail), errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, auth.ErrEmailTaken):
		writeError(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.setSessionCookie(w, token, int(auth.SessionTTL.Seconds()))
	writeJSON(w, http.StatusCreated, map[string]any{"user": u})
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body credentials
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	u, token, err := h.svc.Login(r.Context(), body.Email, body.Password)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		time.Sleep(failedLoginDelay)
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.setSessionCookie(w, token, int(auth.SessionTTL.Seconds()))
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

// Logout handles POST /api/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookieName); err == nil {
		_ = h.svc.Logout(r.Context(), c.Value)
	}
	h.setSessionCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /api/auth/me. It is public and always 200, so the frontend
// can learn both whether it is logged in and whether signups are open
// without provoking a 401.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	var user *auth.User
	if c, err := r.Cookie(sessionCookieName); err == nil {
		user, _ = h.svc.Authenticate(r.Context(), c.Value)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user":        user,
		"allowSignup": h.allowSignup,
	})
}

func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   !h.isDev,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	})
}
