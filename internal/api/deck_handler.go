package api

import (
	"encoding/json"
	"errors"
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
	decks, err := h.svc.List(r.Context(), userID(r))
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
	d, err := h.svc.Create(r.Context(), userID(r), body.Name, body.Format)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

// Get handles GET /api/decks/{id}
func (h *DeckHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	d, err := h.svc.Get(r.Context(), userID(r), id)
	if err != nil {
		writeDeckError(w, http.StatusInternalServerError, err)
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
	d, err := h.svc.Update(r.Context(), userID(r), id, body.Name, body.Format)
	if err != nil {
		writeDeckError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// Delete handles DELETE /api/decks/{id}
func (h *DeckHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		writeDeckError(w, http.StatusInternalServerError, err)
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
	created, err := h.svc.AddEntry(r.Context(), userID(r), deckID, entry)
	if err != nil {
		writeDeckError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

// UpdateEntry handles PUT /api/decks/{id}/entries/{eid}
func (h *DeckHandler) UpdateEntry(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "id")
	entryID := chi.URLParam(r, "eid")
	var body struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.UpdateEntry(r.Context(), userID(r), deckID, entryID, body.Count); err != nil {
		writeDeckError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateEntryArt handles PUT /api/decks/{id}/entries/{eid}/art
func (h *DeckHandler) UpdateEntryArt(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "id")
	entryID := chi.URLParam(r, "eid")
	var body struct {
		ImageURL string `json:"imageUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.UpdateEntryImageURL(r.Context(), userID(r), deckID, entryID, body.ImageURL); err != nil {
		writeDeckError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteEntry handles DELETE /api/decks/{id}/entries/{eid}
func (h *DeckHandler) DeleteEntry(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "id")
	entryID := chi.URLParam(r, "eid")
	if err := h.svc.DeleteEntry(r.Context(), userID(r), deckID, entryID); err != nil {
		writeDeckError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SetCovers handles PUT /api/decks/{id}/covers
// Body: { "entryIds": ["...", "..."] }
func (h *DeckHandler) SetCovers(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "id")
	var body struct {
		EntryIDs []string `json:"entryIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.SetCovers(r.Context(), userID(r), deckID, body.EntryIDs); err != nil {
		writeDeckError(w, http.StatusBadRequest, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Import ───────────────────────────────────────────────────────────────────

// Import handles POST /api/decks/import
// Body: { "text": "...", "name": "My Deck", "format": "standard", "save": true,
//
//	"imageUrls": ["", "https://..."] }
//
// Query param: ?format=ptcglive|limitless  (default: ptcglive)
//
// imageUrls lines up by index with the parsed entries (the same order a
// save:false preview returns), so art picked during review is saved with the
// deck. An empty string keeps the automatic art.
func (h *DeckHandler) Import(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text      string   `json:"text"`
		Name      string   `json:"name"`
		Format    string   `json:"format"`
		Save      bool     `json:"save"`
		ImageURLs []string `json:"imageUrls"`
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

	// Before both preview and save, so the review shows the exact cards.
	h.svc.ResolveCardIDs(r.Context(), d.Entries)

	if len(body.ImageURLs) > len(d.Entries) {
		writeError(w, http.StatusBadRequest, "more imageUrls than entries")
		return
	}
	for i, url := range body.ImageURLs {
		if url != "" {
			d.Entries[i].ImageURL = url
		}
	}

	if body.Name != "" {
		d.Name = body.Name
	}
	if body.Format != "" {
		d.Format = body.Format
	}

	if body.Save {
		saved, err := h.svc.Import(r.Context(), userID(r), d)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, saved)
		return
	}

	writeJSON(w, http.StatusOK, d)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// writeDeckError responds 404 for deck.ErrNotFound (including another user's
// deck) and with the given fallback status otherwise.
func writeDeckError(w http.ResponseWriter, fallback int, err error) {
	if errors.Is(err, deck.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeError(w, fallback, err.Error())
}

func formatterFor(fmt string) format.DeckFormatter {
	switch strings.ToLower(fmt) {
	case "limitless":
		return limitless.New()
	default:
		return ptcglive.New()
	}
}
