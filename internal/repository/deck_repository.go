package repository

import (
	"context"

	"github.com/dariomendez/poketools/internal/deck"
)

// DeckRepository defines persistence operations for decks.
type DeckRepository interface {
	List(ctx context.Context) ([]*deck.Deck, error)
	Get(ctx context.Context, id string) (*deck.Deck, error)
	Create(ctx context.Context, d *deck.Deck) error
	Update(ctx context.Context, d *deck.Deck) error
	Delete(ctx context.Context, id string) error

	AddEntry(ctx context.Context, entry *deck.CardEntry) error
	UpdateEntry(ctx context.Context, id string, count int) error
	DeleteEntry(ctx context.Context, id string) error
	ReplaceEntries(ctx context.Context, deckID string, entries []deck.CardEntry) error
}
