package sqlitedb

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/dariomendez/poketools/internal/deck"
)

// SQLiteDeckRepository implements deck.Repository using sqlc Queries.
type SQLiteDeckRepository struct {
	q  *Queries
	db *sql.DB
}

func NewDeckRepository(db *sql.DB) *SQLiteDeckRepository {
	return &SQLiteDeckRepository{q: New(db), db: db}
}

func (r *SQLiteDeckRepository) List(ctx context.Context, userID string) ([]*deck.Deck, error) {
	rows, err := r.q.ListDecks(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list decks: %w", err)
	}
	decks := make([]*deck.Deck, 0, len(rows))
	for _, row := range rows {
		decks = append(decks, deckFromRow(row, nil))
	}
	return decks, nil
}

func (r *SQLiteDeckRepository) Get(ctx context.Context, userID, id string) (*deck.Deck, error) {
	row, err := r.q.GetDeck(ctx, GetDeckParams{ID: id, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, deck.ErrNotFound
	}
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
		UserID:    d.UserID,
		Name:      d.Name,
		Format:    d.Format,
		CreatedAt: d.CreatedAt.UnixMilli(),
		UpdatedAt: d.UpdatedAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("create deck: %w", err)
	}
	return nil
}

func (r *SQLiteDeckRepository) Update(ctx context.Context, d *deck.Deck) error {
	n, err := r.q.UpdateDeck(ctx, UpdateDeckParams{
		Name:      d.Name,
		Format:    d.Format,
		UpdatedAt: d.UpdatedAt.UnixMilli(),
		ID:        d.ID,
		UserID:    d.UserID,
	})
	return rowsAffected(n, err, "update deck")
}

func (r *SQLiteDeckRepository) Delete(ctx context.Context, userID, id string) error {
	n, err := r.q.DeleteDeck(ctx, DeleteDeckParams{ID: id, UserID: userID})
	return rowsAffected(n, err, "delete deck")
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

func (r *SQLiteDeckRepository) UpdateEntryImageURL(ctx context.Context, deckID, id string, imageURL string) error {
	n, err := r.q.UpdateEntryImageUrl(ctx, UpdateEntryImageUrlParams{
		ImageUrl: imageURL,
		ID:       id,
		DeckID:   deckID,
	})
	return rowsAffected(n, err, "update entry image url")
}

func (r *SQLiteDeckRepository) UpdateEntry(ctx context.Context, deckID, id string, count int) error {
	n, err := r.q.UpdateEntryCount(ctx, UpdateEntryCountParams{
		Count:  int64(count),
		ID:     id,
		DeckID: deckID,
	})
	return rowsAffected(n, err, "update entry")
}

func (r *SQLiteDeckRepository) DeleteEntry(ctx context.Context, deckID, id string) error {
	n, err := r.q.DeleteEntry(ctx, DeleteEntryParams{ID: id, DeckID: deckID})
	return rowsAffected(n, err, "delete entry")
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

// rowsAffected maps the result of a scoped :execrows mutation: zero rows means
// the target doesn't exist or isn't the caller's.
func rowsAffected(n int64, err error, op string) error {
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}
	if n == 0 {
		return deck.ErrNotFound
	}
	return nil
}

func deckFromRow(row Deck, entries []DeckEntry) *deck.Deck {
	d := &deck.Deck{
		ID:        row.ID,
		UserID:    row.UserID,
		Name:      row.Name,
		Format:    row.Format,
		CreatedAt: time.UnixMilli(row.CreatedAt).UTC(),
		UpdatedAt: time.UnixMilli(row.UpdatedAt).UTC(),
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
