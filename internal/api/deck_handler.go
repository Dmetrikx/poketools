package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/format"
	"github.com/dariomendez/poketools/internal/format/limitless"
	"github.com/dariomendez/poketools/internal/format/ptcglive"
)

// DeckHandler holds HTTP handlers for deck endpoints.
type DeckHandler struct {
	svc *deck.Service
}

func NewDeckHandler(svc *deck.Service) *DeckHandler {
	return &DeckHandler{svc: svc}
}

// List handles GET /api/decks
func (h *DeckHandler) List(w http.ResponseWriter, r *http.Request) {
	decks, err := h.svc.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, decks)
}

// Create handles POST /api/decks
func (h *DeckHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   string `json:"name"`
		Format string `json:"format"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	d, err := h.svc.Create(r.Context(), body.Name, body.Format)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

// Get handles GET /api/decks/{id}
func (h *DeckHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// Update handles PUT /api/decks/{id}
func (h *DeckHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name   string `json:"name"`
		Format string `json:"format"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	d, err := h.svc.Update(r.Context(), id, body.Name, body.Format)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// Delete handles DELETE /api/decks/{id}
func (h *DeckHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Entries ───────────────────────────────────────────────────────────────────

// AddEntry handles POST /api/decks/{id}/entries
func (h *DeckHandler) AddEntry(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "id")
	var entry deck.CardEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	created, err := h.svc.AddEntry(r.Context(), deckID, entry)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// UpdateEntry handles PUT /api/decks/{id}/entries/{eid}
func (h *DeckHandler) UpdateEntry(w http.ResponseWriter, r *http.Request) {
	entryID := chi.URLParam(r, "eid")
	var body struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.UpdateEntry(r.Context(), entryID, body.Count); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateEntryArt handles PUT /api/decks/{id}/entries/{eid}/art
func (h *DeckHandler) UpdateEntryArt(w http.ResponseWriter, r *http.Request) {
	entryID := chi.URLParam(r, "eid")
	var body struct {
		ImageURL string `json:"imageUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.UpdateEntryImageURL(r.Context(), entryID, body.ImageURL); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteEntry handles DELETE /api/decks/{id}/entries/{eid}
func (h *DeckHandler) DeleteEntry(w http.ResponseWriter, r *http.Request) {
	entryID := chi.URLParam(r, "eid")
	if err := h.svc.DeleteEntry(r.Context(), entryID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Import / Export ───────────────────────────────────────────────────────────

// Import handles POST /api/decks/import
// Body: { "text": "...", "name": "My Deck", "format": "standard", "save": true }
// Query param: ?format=ptcglive|limitless  (default: ptcglive)
func (h *DeckHandler) Import(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text   string `json:"text"`
		Name   string `json:"name"`
		Format string `json:"format"`
		Save   bool   `json:"save"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	formatter := formatterFor(r.URL.Query().Get("format"))
	d, err := formatter.Import(body.Text)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "parse error: "+err.Error())
		return
	}

	if body.Name != "" {
		d.Name = body.Name
	}
	if body.Format != "" {
		d.Format = body.Format
	}

	if body.Save {
		saved, err := h.svc.Import(r.Context(), d)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, saved)
		return
	}

	writeJSON(w, http.StatusOK, d)
}

// Export handles GET /api/decks/{id}/export?format=ptcglive|limitless
func (h *DeckHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	formatter := formatterFor(r.URL.Query().Get("format"))
	text, err := formatter.Export(d)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(text)) //nolint:errcheck
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func formatterFor(fmt string) format.DeckFormatter {
	switch strings.ToLower(fmt) {
	case "limitless":
		return limitless.New()
	default:
		return ptcglive.New()
	}
}
