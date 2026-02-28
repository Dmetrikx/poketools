package format

import "github.com/dariomendez/poketools/internal/deck"

// DeckFormatter defines the import/export contract for a decklist text format.
type DeckFormatter interface {
	// Import parses raw text into a Deck. The returned Deck has no ID set;
	// callers are responsible for persisting it.
	Import(text string) (*deck.Deck, error)

	// Export serialises a Deck into the format's text representation.
	Export(d *deck.Deck) (string, error)
}
