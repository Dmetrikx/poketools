package sqlitedb

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/dariomendez/poketools/internal/deck"
)

// SQLiteDeckRepository implements repository.DeckRepository using sqlc Queries.
type SQLiteDeckRepository struct {
	q  *Queries
	db *sql.DB
}

func NewDeckRepository(db *sql.DB) *SQLiteDeckRepository {
	return &SQLiteDeckRepository{q: New(db), db: db}
}

func (r *SQLiteDeckRepository) List(ctx context.Context) ([]*deck.Deck, error) {
	rows, err := r.q.ListDecks(ctx)
	if err != nil {
		return nil, fmt.Errorf("list decks: %w", err)
	}
	decks := make([]*deck.Deck, 0, len(rows))
	for _, row := range rows {
		decks = append(decks, deckFromRow(row, nil))
	}
	return decks, nil
}

func (r *SQLiteDeckRepository) Get(ctx context.Context, id string) (*deck.Deck, error) {
	row, err := r.q.GetDeck(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get deck %s: %w", id, err)
	}
	entries, err := r.q.ListEntriesByDeck(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("list entries for deck %s: %w", id, err)
	}
	return deckFromRow(row, entries), nil
}

func (r *SQLiteDeckRepository) Create(ctx context.Context, d *deck.Deck) error {
	err := r.q.CreateDeck(ctx, CreateDeckParams{
		ID:        d.ID,
		Name:      d.Name,
		Format:    d.Format,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	})
	if err != nil {
		return fmt.Errorf("create deck: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) Update(ctx context.Context, d *deck.Deck) error {
	err := r.q.UpdateDeck(ctx, UpdateDeckParams{
		Name:      d.Name,
		Format:    d.Format,
		UpdatedAt: d.UpdatedAt,
		ID:        d.ID,
	})
	if err != nil {
		return fmt.Errorf("update deck: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) Delete(ctx context.Context, id string) error {
	if err := r.q.DeleteDeck(ctx, id); err != nil {
		return fmt.Errorf("delete deck: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) AddEntry(ctx context.Context, entry *deck.CardEntry) error {
	err := r.q.CreateEntry(ctx, CreateEntryParams{
		ID:       entry.ID,
		DeckID:   entry.DeckID,
		CardID:   entry.CardID,
		Name:     entry.Name,
		SetCode:  entry.SetCode,
		Number:   entry.Number,
		Count:    int64(entry.Count),
		Section:  string(entry.Section),
		Position: int64(entry.Position),
		ImageUrl: entry.ImageURL,
	})
	if err != nil {
		return fmt.Errorf("add entry: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) UpdateEntryImageURL(ctx context.Context, id string, imageURL string) error {
	err := r.q.UpdateEntryImageUrl(ctx, UpdateEntryImageUrlParams{
		ImageUrl: imageURL,
		ID:       id,
	})
	if err != nil {
		return fmt.Errorf("update entry image url: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) UpdateEntry(ctx context.Context, id string, count int) error {
	err := r.q.UpdateEntryCount(ctx, UpdateEntryCountParams{
		Count: int64(count),
		ID:    id,
	})
	if err != nil {
		return fmt.Errorf("update entry: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) DeleteEntry(ctx context.Context, id string) error {
	if err := r.q.DeleteEntry(ctx, id); err != nil {
		return fmt.Errorf("delete entry: %w", err)
	}
	return nil
}

// ReplaceEntries deletes all existing entries for the deck and inserts the new set.
// Used for bulk import.
func (r *SQLiteDeckRepository) ReplaceEntries(ctx context.Context, deckID string, entries []deck.CardEntry) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	q := r.q.WithTx(tx)

	if err := q.DeleteEntriesByDeck(ctx, deckID); err != nil {
		return fmt.Errorf("delete existing entries: %w", err)
	}

	for _, e := range entries {
		if err := q.CreateEntry(ctx, CreateEntryParams{
			ID:       e.ID,
			DeckID:   deckID,
			CardID:   e.CardID,
			Name:     e.Name,
			SetCode:  e.SetCode,
			Number:   e.Number,
			Count:    int64(e.Count),
			Section:  string(e.Section),
			Position: int64(e.Position),
			ImageUrl: e.ImageURL,
		}); err != nil {
			return fmt.Errorf("insert entry: %w", err)
		}
	}

	return tx.Commit()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func deckFromRow(row Deck, entries []DeckEntry) *deck.Deck {
	d := &deck.Deck{
		ID:        row.ID,
		Name:      row.Name,
		Format:    row.Format,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
	for _, e := range entries {
		d.Entries = append(d.Entries, deck.CardEntry{
			ID:       e.ID,
			DeckID:   e.DeckID,
			CardID:   e.CardID,
			Name:     e.Name,
			SetCode:  e.SetCode,
			Number:   e.Number,
			Count:    int(e.Count),
			Section:  deck.Section(e.Section),
			Position: int(e.Position),
			ImageURL: e.ImageUrl,
		})
	}
	return d
}
