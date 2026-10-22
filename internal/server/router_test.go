package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/dariomendez/poketools/internal/api"
	"github.com/dariomendez/poketools/internal/auth"
	"github.com/dariomendez/poketools/internal/card"
	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/repository"
	sqlitedb "github.com/dariomendez/poketools/internal/repository/sqlite"
	"github.com/dariomendez/poketools/pkg/tcgdex"
)

// newTestServer wires the real router over a fresh SQLite database.
func newTestServer(t *testing.T, allowSignup bool) *httptest.Server {
	t.Helper()
	db, err := repository.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := repository.Migrate(db, nil); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	authSvc := auth.NewService(sqlitedb.NewUserRepository(db))
	router := NewRouter(
		authSvc,
		api.NewAuthHandler(authSvc, allowSignup, true),
		api.NewDeckHandler(deck.NewService(sqlitedb.NewDeckRepository(db))),
		api.NewCardHandler(card.NewService(tcgdex.New())),
	)
	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return srv
}

// client is a browser-like HTTP client with its own cookie jar.
type client struct {
	t   *testing.T
	srv *httptest.Server
	c   *http.Client
}

func newClient(t *testing.T, srv *httptest.Server) *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: t, srv: srv, c: &http.Client{Jar: jar}}
}

func (c *client) do(method, path string, body any, out any) int {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body) //nolint:errcheck
	}
	req, _ := http.NewRequest(method, c.srv.URL+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.c.Do(req)
	if err != nil {
		c.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	if out != nil {
		json.NewDecoder(resp.Body).Decode(out) //nolint:errcheck
	}
	return resp.StatusCode
}

func (c *client) signup(email string) {
	c.t.Helper()
	if code := c.do("POST", "/api/auth/signup", map[string]string{
		"email": email, "password": "pikachu123",
	}, nil); code != http.StatusCreated {
		c.t.Fatalf("signup %s: status %d", email, code)
	}
}

func TestAPI_RequiresSession(t *testing.T) {
	srv := newTestServer(t, true)
	anon := newClient(t, srv)

	for _, path := range []string{"/api/decks", "/api/cards/search?q=pikachu"} {
		if code := anon.do("GET", path, nil, nil); code != http.StatusUnauthorized {
			t.Errorf("GET %s without session: status %d, want 401", path, code)
		}
	}

	var me struct {
		User        *auth.User `json:"user"`
		AllowSignup bool       `json:"allowSignup"`
	}
	if code := anon.do("GET", "/api/auth/me", nil, &me); code != http.StatusOK {
		t.Fatalf("GET /api/auth/me: status %d", code)
	}
	if me.User != nil || !me.AllowSignup {
		t.Errorf("me = %+v, want no user and allowSignup", me)
	}
	if code := anon.do("GET", "/health", nil, nil); code != http.StatusOK {
		t.Errorf("GET /health: status %d", code)
	}
}

func TestAPI_SessionLifecycle(t *testing.T) {
	srv := newTestServer(t, true)
	ash := newClient(t, srv)
	ash.signup("ash@example.com")

	if code := ash.do("GET", "/api/decks", nil, nil); code != http.StatusOK {
		t.Fatalf("GET /api/decks after signup: status %d", code)
	}

	if code := ash.do("POST", "/api/auth/logout", nil, nil); code != http.StatusNoContent {
		t.Fatalf("logout: status %d", code)
	}
	if code := ash.do("GET", "/api/decks", nil, nil); code != http.StatusUnauthorized {
		t.Errorf("GET /api/decks after logout: status %d, want 401", code)
	}

	if code := ash.do("POST", "/api/auth/login", map[string]string{
		"email": "ash@example.com", "password": "pikachu123",
	}, nil); code != http.StatusOK {
		t.Fatalf("login: status %d", code)
	}
	if code := ash.do("GET", "/api/decks", nil, nil); code != http.StatusOK {
		t.Errorf("GET /api/decks after login: status %d", code)
	}
}

func TestAPI_SignupClosed(t *testing.T) {
	srv := newTestServer(t, false)
	if code := newClient(t, srv).do("POST", "/api/auth/signup", map[string]string{
		"email": "ash@example.com", "password": "pikachu123",
	}, nil); code != http.StatusForbidden {
		t.Errorf("signup with ALLOW_SIGNUP=false: status %d, want 403", code)
	}
}

func TestAPI_DecksAreIsolatedPerUser(t *testing.T) {
	srv := newTestServer(t, true)
	ash, misty := newClient(t, srv), newClient(t, srv)
	ash.signup("ash@example.com")
	misty.signup("misty@example.com")

	var ashDeck deck.Deck
	if code := ash.do("POST", "/api/decks", map[string]string{"name": "Pikachu ex"}, &ashDeck); code != http.StatusCreated {
		t.Fatalf("create deck: status %d", code)
	}
	var entry deck.CardEntry
	if code := ash.do("POST", "/api/decks/"+ashDeck.ID+"/entries", deck.CardEntry{
		CardID: "sv1-1", Name: "Pikachu", SetCode: "SVI", Number: "1", Count: 4, Section: deck.SectionPokemon,
	}, &entry); code != http.StatusCreated {
		t.Fatalf("add entry: status %d", code)
	}

	var mistyDeck deck.Deck
	if code := misty.do("POST", "/api/decks", map[string]string{"name": "Starmie"}, &mistyDeck); code != http.StatusCreated {
		t.Fatalf("create misty deck: status %d", code)
	}

	var list []deck.Deck
	misty.do("GET", "/api/decks", nil, &list)
	if len(list) != 1 || list[0].ID != mistyDeck.ID {
		t.Errorf("misty's deck list = %+v, want only her own deck", list)
	}

	deckPath := "/api/decks/" + ashDeck.ID
	entryPath := deckPath + "/entries/" + entry.ID
	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{"GET", deckPath, nil},
		{"PUT", deckPath, map[string]string{"name": "stolen"}},
		{"POST", deckPath + "/entries", deck.CardEntry{CardID: "x", Section: deck.SectionTrainer, Count: 1}},
		{"PUT", entryPath, map[string]int{"count": 1}},
		{"PUT", entryPath + "/art", map[string]string{"imageUrl": "x"}},
		{"PUT", deckPath + "/covers", map[string][]string{"entryIds": {entry.ID}}},
		{"DELETE", entryPath, nil},
		// Misty's own deck ID with Ash's entry ID must not reach the entry.
		{"PUT", "/api/decks/" + mistyDeck.ID + "/entries/" + entry.ID, map[string]int{"count": 1}},
		{"DELETE", "/api/decks/" + mistyDeck.ID + "/entries/" + entry.ID, nil},
		{"DELETE", deckPath, nil},
	} {
		if code := misty.do(tc.method, tc.path, tc.body, nil); code != http.StatusNotFound {
			t.Errorf("misty %s %s: status %d, want 404", tc.method, tc.path, code)
		}
	}

	var got deck.Deck
	if code := ash.do("GET", deckPath, nil, &got); code != http.StatusOK {
		t.Fatalf("ash GET own deck: status %d", code)
	}
	if got.Name != "Pikachu ex" || len(got.Entries) != 1 || got.Entries[0].Count != 4 || got.Entries[0].ImageURL != "" {
		t.Errorf("ash's deck was modified by another user: %+v", got)
	}
}

// Nested client-side routes must serve the SPA, not redirect-loop.
func TestAPI_DeckCovers(t *testing.T) {
	srv := newTestServer(t, true)
	ash := newClient(t, srv)
	ash.signup("ash@example.com")

	newDeck := func(name string) deck.Deck {
		var d deck.Deck
		if code := ash.do("POST", "/api/decks", map[string]string{"name": name}, &d); code != http.StatusCreated {
			t.Fatalf("create deck %s: status %d", name, code)
		}
		return d
	}
	addEntry := func(deckID, name string, section deck.Section) deck.CardEntry {
		var e deck.CardEntry
		if code := ash.do("POST", "/api/decks/"+deckID+"/entries", deck.CardEntry{
			Name: name, Count: 1, Section: section,
		}, &e); code != http.StatusCreated {
			t.Fatalf("add entry %s: status %d", name, code)
		}
		return e
	}
	setCovers := func(deckID string, ids ...string) int {
		return ash.do("PUT", "/api/decks/"+deckID+"/covers", map[string][]string{"entryIds": ids}, nil)
	}
	coverIDs := func(covers []deck.CardEntry) []string {
		ids := []string{}
		for _, c := range covers {
			ids = append(ids, c.ID)
		}
		return ids
	}

	d := newDeck("Charizard ex")
	charizard := addEntry(d.ID, "Charizard ex", deck.SectionPokemon)
	arven := addEntry(d.ID, "Arven", deck.SectionTrainer)
	other := addEntry(newDeck("Other").ID, "Pidgeot ex", deck.SectionPokemon)

	// Slot order is the order given.
	if code := setCovers(d.ID, arven.ID, charizard.ID); code != http.StatusNoContent {
		t.Fatalf("set covers: status %d", code)
	}
	var got deck.Deck
	ash.do("GET", "/api/decks/"+d.ID, nil, &got)
	if ids := coverIDs(got.Covers); len(ids) != 2 || ids[0] != arven.ID || ids[1] != charizard.ID {
		t.Errorf("GET deck covers = %v, want [arven charizard]", ids)
	}
	var list []deck.Deck
	ash.do("GET", "/api/decks", nil, &list)
	for _, l := range list {
		if l.ID == d.ID && len(l.Covers) != 2 {
			t.Errorf("list covers = %v, want 2", coverIDs(l.Covers))
		}
	}

	for _, ids := range [][]string{
		{other.ID},                             // another deck's entry
		{charizard.ID, charizard.ID},           // duplicate
		{charizard.ID, arven.ID, charizard.ID}, // too many
	} {
		if code := setCovers(d.ID, ids...); code != http.StatusBadRequest {
			t.Errorf("set covers %v: status %d, want 400", ids, code)
		}
	}

	// Deleting a cover's entry frees its slot.
	if code := ash.do("DELETE", "/api/decks/"+d.ID+"/entries/"+arven.ID, nil, nil); code != http.StatusNoContent {
		t.Fatalf("delete entry: status %d", code)
	}
	got = deck.Deck{}
	ash.do("GET", "/api/decks/"+d.ID, nil, &got)
	if ids := coverIDs(got.Covers); len(ids) != 1 || ids[0] != charizard.ID {
		t.Errorf("covers after deleting arven = %v, want [charizard]", ids)
	}
}

func TestAPI_ImportWithArt(t *testing.T) {
	srv := newTestServer(t, true)
	ash := newClient(t, srv)
	ash.signup("ash@example.com")

	const list = "Pokémon: 4\n4 Charizard ex OBF 125\n\nTrainer: 4\n4 Arven SVI 166\n"
	importDeck := func(imageURLs []string, out any) int {
		return ash.do("POST", "/api/decks/import?format=ptcglive", map[string]any{
			"text": list, "name": "Zard", "save": true, "imageUrls": imageURLs,
		}, out)
	}

	// The preview's entry order is what imageUrls lines up with.
	var preview deck.Deck
	if code := ash.do("POST", "/api/decks/import?format=ptcglive", map[string]any{"text": list}, &preview); code != http.StatusOK {
		t.Fatalf("preview: status %d", code)
	}
	if len(preview.Entries) != 2 || preview.Entries[1].Name != "Arven" {
		t.Fatalf("preview entries = %+v", preview.Entries)
	}

	const art = "https://assets.tcgdex.net/en/sv/sv01/166"
	var saved deck.Deck
	if code := importDeck([]string{"", art}, &saved); code != http.StatusCreated {
		t.Fatalf("import: status %d", code)
	}
	var got deck.Deck
	ash.do("GET", "/api/decks/"+saved.ID, nil, &got)
	urls := map[string]string{}
	for _, e := range got.Entries {
		urls[e.Name] = e.ImageURL
	}
	if urls["Arven"] != art || urls["Charizard ex"] != "" {
		t.Errorf("saved art = %v, want Arven=%s and Charizard ex unset", urls, art)
	}

	if code := importDeck([]string{"", "", art}, nil); code != http.StatusBadRequest {
		t.Errorf("import with too many imageUrls: status %d, want 400", code)
	}
}

func TestSPAFallback_NestedRoute(t *testing.T) {
	srv := newTestServer(t, true)
	resp, err := http.Get(srv.URL + "/decks/abc/practice")
	if err != nil {
		t.Fatalf("GET nested route: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("GET /decks/abc/practice: status %d, want 200", resp.StatusCode)
	}
}
