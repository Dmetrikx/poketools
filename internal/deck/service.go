package deck

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Repository is the persistence interface the service depends on.
type Repository interface {
	List(ctx context.Context) ([]*Deck, error)
	Get(ctx context.Context, id string) (*Deck, error)
	Create(ctx context.Context, d *Deck) error
	Update(ctx context.Context, d *Deck) error
	Delete(ctx context.Context, id string) error

	AddEntry(ctx context.Context, entry *CardEntry) error
	UpdateEntry(ctx context.Context, id string, count int) error
	DeleteEntry(ctx context.Context, id string) error
	ReplaceEntries(ctx context.Context, deckID string, entries []CardEntry) error
}

// Service handles deck business logic.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]*Deck, error) {
	return s.repo.List(ctx)
}

func (s *Service) Get(ctx context.Context, id string) (*Deck, error) {
	d, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get deck: %w", err)
	}
	return d, nil
}

func (s *Service) Create(ctx context.Context, name, format string) (*Deck, error) {
	if name == "" {
		return nil, fmt.Errorf("deck name is required")
	}
	if format == "" {
		format = "standard"
	}
	now := time.Now().UTC()
	d := &Deck{
		ID:        uuid.NewString(),
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

func (s *Service) Update(ctx context.Context, id, name, format string) (*Deck, error) {
	d, err := s.repo.Get(ctx, id)
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

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) AddEntry(ctx context.Context, deckID string, entry CardEntry) (*CardEntry, error) {
	if _, err := s.repo.Get(ctx, deckID); err != nil {
		return nil, fmt.Errorf("deck not found: %w", err)
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

func (s *Service) UpdateEntry(ctx context.Context, id string, count int) error {
	if count < 0 {
		return fmt.Errorf("count must be >= 0")
	}
	return s.repo.UpdateEntry(ctx, id, count)
}

func (s *Service) DeleteEntry(ctx context.Context, id string) error {
	return s.repo.DeleteEntry(ctx, id)
}

// Import saves a fully-formed deck (e.g. parsed from text) by creating it if
// new, then replacing all its entries atomically.
func (s *Service) Import(ctx context.Context, d *Deck) (*Deck, error) {
	now := time.Now().UTC()

	// Assign IDs if missing (fresh import).
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
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
