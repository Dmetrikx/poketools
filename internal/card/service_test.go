package card

import (
	"context"
	"errors"
	"testing"

	"github.com/dariomendez/poketools/pkg/tcgdex"
)

// fakeTCGdex serves a fixed catalogue.
type fakeTCGdex struct {
	sets    map[string]string // official code → set ID
	cards   map[string]bool   // existing card IDs
	search  map[string][]tcgdex.CardBrief
	pocket  []string
	failGet bool
}

func (f *fakeTCGdex) SetIDByCode(_ context.Context, code string) (string, error) {
	return f.sets[code], nil
}

func (f *fakeTCGdex) GetCard(_ context.Context, id string) (*tcgdex.Card, error) {
	if f.failGet {
		return nil, errors.New("connection refused")
	}
	if !f.cards[id] {
		return nil, tcgdex.ErrNotFound
	}
	return &tcgdex.Card{ID: id}, nil
}

func (f *fakeTCGdex) SearchCards(_ context.Context, query, setID string) ([]tcgdex.CardBrief, error) {
	return f.search[query+"|"+setID], nil
}

func (f *fakeTCGdex) SeriesSetIDs(_ context.Context, serieID string) ([]string, error) {
	if serieID != "tcgp" {
		return nil, nil
	}
	return f.pocket, nil
}

func newFake() *fakeTCGdex {
	return &fakeTCGdex{
		sets: map[string]string{"SVI": "sv01", "SSH": "swsh1", "BRS": "swsh9", "SVE": "sve"},
		cards: map[string]bool{
			"sv01-166": true, "sv01-001": true, "swsh1-1": true,
			"swsh9tg-TG01": true, "sve-002": true,
		},
		search: map[string][]tcgdex.CardBrief{
			"Fire Energy|swsh": {
				{ID: "swsh3-174", Name: "Heat Fire Energy"},
				{ID: "swsh12.5-153", Name: "Fire Energy"},
			},
			"Arven|": {
				{ID: "B2a-091", Name: "Arven"},
				{ID: "sv01-166", Name: "Arven"},
				{ID: "P-A-001", Name: "Arven"},
			},
		},
		pocket: []string{"A1", "P-A", "B2a"},
	}
}

func TestResolve(t *testing.T) {
	svc := NewService(newFake())
	for _, tc := range []struct {
		code, number, name, want string
	}{
		{"SVI", "166", "Arven", "sv01-166"},
		{"SSH", "1", "Grookey", "swsh1-1"},          // older sets aren't padded
		{"SVI", "1", "Pineco", "sv01-001"},          // SV sets are
		{"BRS", "TG01", "Flareon", "swsh9tg-TG01"},  // Trainer Gallery set
		{"SVE", "2", "Basic {R} Energy", "sve-002"}, // exact print when it maps
		{"XYZ", "2", "Basic {R} Energy", "swsh12.5-153"},
		{"XYZ", "12", "Arven", ""},
		{"SVI", "999", "Arven", ""},
	} {
		got, err := svc.Resolve(context.Background(), tc.code, tc.number, tc.name)
		if err != nil {
			t.Errorf("Resolve(%s %s): %v", tc.code, tc.number, err)
			continue
		}
		if got != tc.want {
			t.Errorf("Resolve(%s %s %q) = %q, want %q", tc.code, tc.number, tc.name, got, tc.want)
		}
	}
}

func TestResolve_TransportError(t *testing.T) {
	f := newFake()
	f.failGet = true
	if _, err := NewService(f).Resolve(context.Background(), "SVI", "166", "Arven"); err == nil {
		t.Fatal("Resolve with TCGdex down: want error, got nil")
	}
}

func TestSearch_DropsPocketCards(t *testing.T) {
	got, err := NewService(newFake()).Search(context.Background(), "Arven", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "sv01-166" {
		t.Errorf("Search = %+v, want only sv01-166", got)
	}
}
