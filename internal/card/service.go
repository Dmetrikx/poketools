package card

import (
	"context"
	"fmt"

	"github.com/dariomendez/poketools/pkg/tcgdex"
)

// TCGdexClient is the interface the service depends on (makes it testable).
type TCGdexClient interface {
	SearchCards(ctx context.Context, query, setID string) ([]tcgdex.CardBrief, error)
	GetCard(ctx context.Context, id string) (*tcgdex.Card, error)
}

// Service proxies card lookup to TCGdex.
type Service struct {
	client TCGdexClient
}

func NewService(client TCGdexClient) *Service {
	return &Service{client: client}
}

// Search returns cards matching the query and optional set filter.
func (s *Service) Search(ctx context.Context, query, setID string) ([]Brief, error) {
	raw, err := s.client.SearchCards(ctx, query, setID)
	if err != nil {
		return nil, fmt.Errorf("search cards: %w", err)
	}
	out := make([]Brief, 0, len(raw))
	for _, r := range raw {
		out = append(out, Brief{
			ID:    r.ID,
			Name:  r.Name,
			Image: r.Image,
		})
	}
	return out, nil
}

// Get returns the full detail for a single card.
func (s *Service) Get(ctx context.Context, id string) (*Card, error) {
	raw, err := s.client.GetCard(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get card %s: %w", id, err)
	}
	return &Card{
		ID:      raw.ID,
		Name:    raw.Name,
		SetID:   raw.Set.ID,
		SetName: raw.Set.Name,
		Number:  raw.LocalID,
		Types:   raw.Types,
		HP:      raw.HP,
		Rarity:  raw.Rarity,
		Image:   raw.Image,
	}, nil
}
