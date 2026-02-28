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
	ID       string
	DeckID   string
	CardID   string // TCGdex card ID
	Name     string
	SetCode  string
	Number   string
	Count    int
	Section  Section
	Position int
}

type Deck struct {
	ID        string
	Name      string
	Format    string // "standard", "expanded"
	Entries   []CardEntry
	CreatedAt time.Time
	UpdatedAt time.Time
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
