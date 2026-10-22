package card

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/dariomendez/poketools/pkg/tcgdex"
)

// TCGdexClient is the interface the service depends on (makes it testable).
type TCGdexClient interface {
	SearchCards(ctx context.Context, query, setID string) ([]tcgdex.CardBrief, error)
	GetCard(ctx context.Context, id string) (*tcgdex.Card, error)
	SetIDByCode(ctx context.Context, code string) (string, error)
	SeriesSetIDs(ctx context.Context, serieID string) ([]string, error)
}

// pocketSeries is TCGdex's series for TCG Pocket, the mobile game. Its cards
// share names with the physical TCG but aren't playable in it.
const pocketSeries = "tcgp"

// Service proxies card lookup to TCGdex.
type Service struct {
	client TCGdexClient
}

func NewService(client TCGdexClient) *Service {
	return &Service{client: client}
}

// isBasicEnergy checks if a card is a basic energy card.
func isBasicEnergy(category string) bool {
	return category == "Energy"
}

// Search returns cards matching the query and optional set filter.
func (s *Service) Search(ctx context.Context, query, setID string) ([]Brief, error) {
	raw, err := s.client.SearchCards(ctx, query, setID)
	if err != nil {
		return nil, fmt.Errorf("search cards: %w", err)
	}
	pocket := s.pocketSets(ctx)
	out := make([]Brief, 0, len(raw))
	for _, r := range raw {
		if pocket[setOf(r.ID)] {
			continue
		}
		out = append(out, Brief{
			ID:    r.ID,
			Name:  r.Name,
			Image: r.Image,
		})
	}
	return out, nil
}

// Get returns the full detail for a single card.
// For basic energy cards, it fetches the swsh set version to ensure image availability.
func (s *Service) Get(ctx context.Context, id string) (*Card, error) {
	raw, err := s.client.GetCard(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get card %s: %w", id, err)
	}

	card := &Card{
		ID:      raw.ID,
		Name:    raw.Name,
		SetID:   raw.Set.ID,
		SetName: raw.Set.Name,
		Number:  raw.LocalID,
		Types:   raw.Types,
		HP:      raw.HP,
		Rarity:  raw.Rarity,
		Image:   raw.Image,
		Stage:   raw.Stage,
	}

	// For basic energy cards, fetch the swsh version to get a reliable image
	if isBasicEnergy(raw.Category) && raw.Set.ID != "swsh" {
		swshResults, err := s.client.SearchCards(ctx, raw.Name, "swsh")
		if err == nil && len(swshResults) > 0 {
			card.Image = swshResults[0].Image
		}
	}

	return card, nil
}

// Resolve finds the TCGdex card a decklist line names by its set code and
// number (e.g. "SVI" "166" → "sv01-166"). It returns "" when nothing matches,
// and an error only when TCGdex can't be reached.
//
// Numbering differs by era: SV onward is zero-padded ("sv01-001"), older sets
// aren't ("swsh1-1"), and gallery cards ("TG01", "GG01") live in their own
// sets ("swsh9tg", "swsh12.5gg").
func (s *Service) Resolve(ctx context.Context, setCode, number, name string) (string, error) {
	setID := ""
	if setCode != "" && number != "" {
		var err error
		if setID, err = s.client.SetIDByCode(ctx, setCode); err != nil {
			return "", fmt.Errorf("map set code %s: %w", setCode, err)
		}
	}
	if setID != "" {
		for _, id := range candidateIDs(setID, number) {
			_, err := s.client.GetCard(ctx, id)
			if err == nil {
				return id, nil
			}
			if !errors.Is(err, tcgdex.ErrNotFound) {
				return "", fmt.Errorf("get card %s: %w", id, err)
			}
		}
	}

	// PTCG Live writes basic energy as "Basic {R} Energy", sometimes with a set
	// code TCGdex doesn't have; any print of it will do.
	if m := basicEnergyName.FindStringSubmatch(name); m != nil {
		energy := energyTypes[m[1]] + " Energy"
		results, err := s.client.SearchCards(ctx, energy, "swsh")
		if err != nil {
			return "", fmt.Errorf("search %s: %w", energy, err)
		}
		for _, r := range results {
			if r.Name == energy {
				return r.ID, nil
			}
		}
	}
	return "", nil
}

var basicEnergyName = regexp.MustCompile(`^Basic \{([GRWLPFDMY])\} Energy$`)

var energyTypes = map[string]string{
	"G": "Grass", "R": "Fire", "W": "Water", "L": "Lightning", "P": "Psychic",
	"F": "Fighting", "D": "Darkness", "M": "Metal", "Y": "Fairy",
}

// candidateIDs lists the TCGdex IDs a set + printed number may have, most
// likely first.
func candidateIDs(setID, number string) []string {
	ids := []string{setID + "-" + number}
	if n, err := strconv.Atoi(number); err == nil {
		if padded := fmt.Sprintf("%03d", n); padded != number {
			ids = append(ids, setID+"-"+padded)
		}
	} else if prefix := strings.TrimRight(number, "0123456789"); prefix != "" && prefix != number {
		ids = append(ids, setID+strings.ToLower(prefix)+"-"+number)
	}
	return ids
}

// pocketSets returns the IDs of TCG Pocket sets. If TCGdex can't say, it
// returns nil: showing Pocket cards beats failing the search.
func (s *Service) pocketSets(ctx context.Context) map[string]bool {
	ids, err := s.client.SeriesSetIDs(ctx, pocketSeries)
	if err != nil {
		return nil
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set
}

// setOf returns the set part of a TCGdex card ID ("sv04.5-235" → "sv04.5",
// "P-A-001" → "P-A").
func setOf(cardID string) string {
	if i := strings.LastIndex(cardID, "-"); i > 0 {
		return cardID[:i]
	}
	return cardID
}
