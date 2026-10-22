package deck

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Repository is the persistence interface the service depends on. Every
// method that addresses a deck is scoped by owner and returns ErrNotFound for
// a deck that doesn't exist or belongs to someone else.
type Repository interface {
	List(ctx context.Context, userID string) ([]*Deck, error)
	Get(ctx context.Context, userID, id string) (*Deck, error)
	Create(ctx context.Context, d *Deck) error
	Update(ctx context.Context, d *Deck) error
	Delete(ctx context.Context, userID, id string) error

	AddEntry(ctx context.Context, entry *CardEntry) error
	UpdateEntry(ctx context.Context, deckID, id string, count int) error
	UpdateEntryImageURL(ctx context.Context, deckID, id string, imageURL string) error
	DeleteEntry(ctx context.Context, deckID, id string) error
	ReplaceEntries(ctx context.Context, deckID string, entries []CardEntry) error
	SetCovers(ctx context.Context, deckID string, entryIDs []string) error
}

// Service handles deck business logic. Every method takes the ID of the user
// acting, and only ever touches that user's decks.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, userID string) ([]*Deck, error) {
	return s.repo.List(ctx, userID)
}

func (s *Service) Get(ctx context.Context, userID, id string) (*Deck, error) {
	d, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, fmt.Errorf("get deck: %w", err)
	}
	return d, nil
}

func (s *Service) Create(ctx context.Context, userID, name, format string) (*Deck, error) {
	if name == "" {
		return nil, fmt.Errorf("deck name is required")
	}
	if format == "" {
		format = "standard"
	}
	now := time.Now().UTC()
	d := &Deck{
		ID:        uuid.NewString(),
		UserID:    userID,
		Name:      name,
		Format:    format,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("create deck: %w", err)
	}
	return d, nil
}

func (s *Service) Update(ctx context.Context, userID, id, name, format string) (*Deck, error) {
	d, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, fmt.Errorf("get deck: %w", err)
	}
	if name != "" {
		d.Name = name
	}
	if format != "" {
		d.Format = format
	}
	d.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, d); err != nil {
		return nil, fmt.Errorf("update deck: %w", err)
	}
	return d, nil
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *Service) AddEntry(ctx context.Context, userID, deckID string, entry CardEntry) (*CardEntry, error) {
	if _, err := s.repo.Get(ctx, userID, deckID); err != nil {
		return nil, fmt.Errorf("get deck: %w", err)
	}
	if !entry.Section.Valid() {
		return nil, fmt.Errorf("invalid section: %q", entry.Section)
	}
	entry.ID = uuid.NewString()
	entry.DeckID = deckID
	if err := s.repo.AddEntry(ctx, &entry); err != nil {
		return nil, fmt.Errorf("add entry: %w", err)
	}
	return &entry, nil
}

func (s *Service) UpdateEntry(ctx context.Context, userID, deckID, id string, count int) error {
	if count < 0 {
		return fmt.Errorf("count must be >= 0")
	}
	if _, err := s.repo.Get(ctx, userID, deckID); err != nil {
		return fmt.Errorf("get deck: %w", err)
	}
	return s.repo.UpdateEntry(ctx, deckID, id, count)
}

func (s *Service) UpdateEntryImageURL(ctx context.Context, userID, deckID, id string, imageURL string) error {
	if _, err := s.repo.Get(ctx, userID, deckID); err != nil {
		return fmt.Errorf("get deck: %w", err)
	}
	return s.repo.UpdateEntryImageURL(ctx, deckID, id, imageURL)
}

func (s *Service) DeleteEntry(ctx context.Context, userID, deckID, id string) error {
	if _, err := s.repo.Get(ctx, userID, deckID); err != nil {
		return fmt.Errorf("get deck: %w", err)
	}
	return s.repo.DeleteEntry(ctx, deckID, id)
}

// SetCovers replaces the deck's cover cards with the given entries, in slot
// order. Every entry must belong to the deck.
func (s *Service) SetCovers(ctx context.Context, userID, deckID string, entryIDs []string) error {
	if len(entryIDs) > MaxCovers {
		return fmt.Errorf("at most %d covers", MaxCovers)
	}
	d, err := s.repo.Get(ctx, userID, deckID)
	if err != nil {
		return fmt.Errorf("get deck: %w", err)
	}
	inDeck := make(map[string]bool, len(d.Entries))
	for _, e := range d.Entries {
		inDeck[e.ID] = true
	}
	seen := make(map[string]bool, len(entryIDs))
	for _, id := range entryIDs {
		if !inDeck[id] {
			return fmt.Errorf("entry %q is not in this deck", id)
		}
		if seen[id] {
			return fmt.Errorf("entry %q is a cover twice", id)
		}
		seen[id] = true
	}
	return s.repo.SetCovers(ctx, deckID, entryIDs)
}

// Import saves a fully-formed deck (e.g. parsed from text) for the given user
// by creating it, then replacing all its entries atomically.
func (s *Service) Import(ctx context.Context, userID string, d *Deck) (*Deck, error) {
	now := time.Now().UTC()

	// Always a new deck owned by the caller: never trust an ID from the
	// parsed input, which could name someone else's deck.
	d.ID = uuid.NewString()
	d.UserID = userID
	d.CreatedAt = now
	d.UpdatedAt = now

	for i := range d.Entries {
		if d.Entries[i].ID == "" {
			d.Entries[i].ID = uuid.NewString()
		}
		d.Entries[i].DeckID = d.ID
		d.Entries[i].Position = i
	}

	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("create imported deck: %w", err)
	}
	if err := s.repo.ReplaceEntries(ctx, d.ID, d.Entries); err != nil {
		return nil, fmt.Errorf("save entries: %w", err)
	}
	return d, nil
}
