package ptcglive_test

import (
	"strings"
	"testing"

	"github.com/dariomendez/poketools/internal/deck"
	"github.com/dariomendez/poketools/internal/format/ptcglive"
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
	f := ptcglive.New()
	d, err := f.Import(sampleDeck)
	if err != nil {
		t.Fatalf("import: %v", err)
	}

	if got, want := d.TotalCards(), 20; got != want {
		t.Errorf("TotalCards = %d, want %d", got, want)
	}

	pokemon := d.EntriesBySection(deck.SectionPokemon)
	if len(pokemon) != 1 {
		t.Fatalf("pokemon entries = %d, want 1", len(pokemon))
	}
	if pokemon[0].Name != "Charizard ex" {
		t.Errorf("name = %q, want %q", pokemon[0].Name, "Charizard ex")
	}
	if pokemon[0].SetCode != "OBF" {
		t.Errorf("setCode = %q, want %q", pokemon[0].SetCode, "OBF")
	}
	if pokemon[0].Number != "125" {
		t.Errorf("number = %q, want %q", pokemon[0].Number, "125")
	}
	if pokemon[0].Count != 4 {
		t.Errorf("count = %d, want 4", pokemon[0].Count)
	}

	trainers := d.EntriesBySection(deck.SectionTrainer)
	if len(trainers) != 2 {
		t.Fatalf("trainer entries = %d, want 2", len(trainers))
	}
}

func TestRoundtrip(t *testing.T) {
	f := ptcglive.New()
	d, err := f.Import(sampleDeck)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	d.Name = "Test Deck"

	exported, err := f.Export(d)
	if err != nil {
		t.Fatalf("export: %v", err)
	}

	// Re-import exported text and compare totals.
	d2, err := f.Import(exported)
	if err != nil {
		t.Fatalf("re-import: %v", err)
	}
	if d.TotalCards() != d2.TotalCards() {
		t.Errorf("total cards mismatch: %d != %d", d.TotalCards(), d2.TotalCards())
	}

	if !strings.Contains(exported, "Total Cards: 20") {
		t.Errorf("expected 'Total Cards: 20' in export, got:\n%s", exported)
	}
}
