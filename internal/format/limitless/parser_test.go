package limitless_test

import (
	"testing"

	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/format/limitless"
)

const sampleDeck = `Pokémon: 4
4 Charizard ex OBF 125

Trainer: 6
4 Professor's Research SVI 190
2 Ultra Ball SVI 196

Energy: 10
10 Basic {R} Energy SVE 2

Total Cards: 20`

func TestImport(t *testing.T) {
	f := limitless.New()
	d, err := f.Import(sampleDeck)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if got, want := d.TotalCards(), 20; got != want {
		t.Errorf("TotalCards = %d, want %d", got, want)
	}
	pokemon := d.EntriesBySection(deck.SectionPokemon)
	if len(pokemon) != 1 || pokemon[0].Name != "Charizard ex" {
		t.Errorf("unexpected pokemon entry: %+v", pokemon)
	}
}

func TestRoundtrip(t *testing.T) {
	f := limitless.New()
	d, err := f.Import(sampleDeck)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	d.Name = "Test Deck"
	exported, err := f.Export(d)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	d2, err := f.Import(exported)
	if err != nil {
		t.Fatalf("re-import: %v", err)
	}
	if d.TotalCards() != d2.TotalCards() {
		t.Errorf("total cards mismatch: %d != %d", d.TotalCards(), d2.TotalCards())
	}
}
