// Package limitless implements the Limitless TCG decklist text format.
//
// The Limitless format is nearly identical to PTCG Live but uses "Pokémon"
// (with accent) consistently and sometimes omits the card number, using only
// set code. We parse both variants and export in canonical Limitless style.
//
// Example:
//
//	Pokémon: 4
//	4 Charizard ex OBF 125
//
//	Trainer: 6
//	4 Professor's Research SVI 190
//
//	Energy: 10
//	10 Basic {R} Energy SVE 2
//
//	Total Cards: 20
package limitless

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dariomendez/poketools/internal/deck"
)

// Formatter implements format.DeckFormatter for Limitless TCG.
type Formatter struct{}

func New() *Formatter { return &Formatter{} }

// Import parses Limitless TCG decklist text into a Deck.
// The format is identical to PTCG Live; this formatter is a distinct type to
// allow format-specific customisation as the formats diverge.
func (f *Formatter) Import(text string) (*deck.Deck, error) {
	d := &deck.Deck{Format: "standard"}
	var currentSection deck.Section

	for _, rawLine := range strings.Split(text, "\n") {
		line := strings.TrimSpace(rawLine)

		if line == "" || strings.HasPrefix(line, "Total Cards:") {
			continue
		}

		switch {
		case strings.HasPrefix(line, "Pokémon:"), strings.HasPrefix(line, "Pokemon:"):
			currentSection = deck.SectionPokemon
			continue
		case strings.HasPrefix(line, "Trainer:"):
			currentSection = deck.SectionTrainer
			continue
		case strings.HasPrefix(line, "Energy:"):
			currentSection = deck.SectionEnergy
			continue
		}

		entry, err := parseCardLine(line, currentSection)
		if err != nil {
			return nil, fmt.Errorf("parse line %q: %w", line, err)
		}
		d.Entries = append(d.Entries, entry)
	}

	return d, nil
}

// Export serialises a Deck into Limitless TCG format.
func (f *Formatter) Export(d *deck.Deck) (string, error) {
	var sb strings.Builder

	sections := []struct {
		header  string
		section deck.Section
	}{
		{"Pokémon", deck.SectionPokemon},
		{"Trainer", deck.SectionTrainer},
		{"Energy", deck.SectionEnergy},
	}

	for _, s := range sections {
		entries := d.EntriesBySection(s.section)
		if len(entries) == 0 {
			continue
		}
		sectionTotal := 0
		for _, e := range entries {
			sectionTotal += e.Count
		}
		fmt.Fprintf(&sb, "%s: %d\n", s.header, sectionTotal)
		for _, e := range entries {
			fmt.Fprintf(&sb, "%d %s %s %s\n", e.Count, e.Name, e.SetCode, e.Number)
		}
		sb.WriteString("\n")
	}

	fmt.Fprintf(&sb, "Total Cards: %d\n", d.TotalCards())
	return sb.String(), nil
}

func parseCardLine(line string, section deck.Section) (deck.CardEntry, error) {
	tokens := strings.Fields(line)
	if len(tokens) < 4 {
		return deck.CardEntry{}, fmt.Errorf("expected at least 4 tokens, got %d", len(tokens))
	}

	count, err := strconv.Atoi(tokens[0])
	if err != nil {
		return deck.CardEntry{}, fmt.Errorf("invalid count %q: %w", tokens[0], err)
	}

	number := tokens[len(tokens)-1]
	setCode := tokens[len(tokens)-2]
	name := strings.Join(tokens[1:len(tokens)-2], " ")

	return deck.CardEntry{
		Name:    name,
		SetCode: setCode,
		Number:  number,
		Count:   count,
		Section: section,
	}, nil
}
