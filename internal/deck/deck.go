package deck

import "time"

type Section string

const (
	SectionPokemon Section = "pokemon"
	SectionTrainer Section = "trainer"
	SectionEnergy  Section = "energy"
)

func (s Section) Valid() bool {
	switch s {
	case SectionPokemon, SectionTrainer, SectionEnergy:
		return true
	}
	return false
}

type CardEntry struct {
	ID       string  `json:"id"`
	DeckID   string  `json:"deckId"`
	CardID   string  `json:"cardId"` // TCGdex card ID
	Name     string  `json:"name"`
	SetCode  string  `json:"setCode"`
	Number   string  `json:"number"`
	Count    int     `json:"count"`
	Section  Section `json:"section"`
	Position int     `json:"position"`
	ImageURL string  `json:"imageUrl"`
}

type Deck struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	Format    string      `json:"format"` // "standard", "expanded"
	Entries   []CardEntry `json:"entries"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// TotalCards returns the sum of all entry counts.
func (d *Deck) TotalCards() int {
	total := 0
	for _, e := range d.Entries {
		total += e.Count
	}
	return total
}

// EntriesBySection returns entries filtered to a given section.
func (d *Deck) EntriesBySection(s Section) []CardEntry {
	var out []CardEntry
	for _, e := range d.Entries {
		if e.Section == s {
			out = append(out, e)
		}
	}
	return out
}
