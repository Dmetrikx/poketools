package tcgdex

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSetIDByCode(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		if r.URL.Path != "/en/sets" {
			t.Errorf("path = %q, want /en/sets", r.URL.Path)
		}
		switch r.URL.Query().Get("abbreviation.official") {
		case "eq:SVI":
			w.Write([]byte(`[{"id":"sv01","name":"Scarlet & Violet"}]`)) //nolint:errcheck
		default:
			w.Write([]byte(`[]`)) //nolint:errcheck
		}
	}))
	defer srv.Close()
	c := New(WithBaseURL(srv.URL))
	ctx := context.Background()

	for range 2 {
		id, err := c.SetIDByCode(ctx, "SVI")
		if err != nil || id != "sv01" {
			t.Fatalf("SetIDByCode(SVI) = %q, %v; want sv01", id, err)
		}
	}
	if hits != 1 {
		t.Errorf("upstream hits = %d, want 1 (cached)", hits)
	}

	// Misses are cached as "".
	for range 2 {
		if id, err := c.SetIDByCode(ctx, "NOPE"); err != nil || id != "" {
			t.Fatalf("SetIDByCode(NOPE) = %q, %v; want empty", id, err)
		}
	}
	if hits != 2 {
		t.Errorf("upstream hits = %d, want 2", hits)
	}
}

func TestSeriesSetIDs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/en/series/tcgp" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.Write([]byte(`{"id":"tcgp","sets":[{"id":"A1"},{"id":"P-A"}]}`)) //nolint:errcheck
	}))
	defer srv.Close()

	ids, err := New(WithBaseURL(srv.URL)).SeriesSetIDs(context.Background(), "tcgp")
	if err != nil || len(ids) != 2 || ids[0] != "A1" || ids[1] != "P-A" {
		t.Fatalf("SeriesSetIDs = %v, %v; want [A1 P-A]", ids, err)
	}
}

func TestGetCard_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer srv.Close()

	_, err := New(WithBaseURL(srv.URL)).GetCard(context.Background(), "sv01-1")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}
