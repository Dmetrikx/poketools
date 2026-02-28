package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dariomendez/poketools/internal/card"
)

// CardHandler holds HTTP handlers for card endpoints.
type CardHandler struct {
	svc *card.Service
}

func NewCardHandler(svc *card.Service) *CardHandler {
	return &CardHandler{svc: svc}
}

// Search handles GET /api/cards/search?q=...&set=...
func (h *CardHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	set := r.URL.Query().Get("set")

	results, err := h.svc.Search(r.Context(), q, set)
	if err != nil {
		writeError(w, http.StatusBadGateway, "card search failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

// Get handles GET /api/cards/{id}
func (h *CardHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	c, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}
