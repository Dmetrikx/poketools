package tcgdex

// Card represents a card returned by the TCGdex API.
type Card struct {
	ID          string   `json:"id"`
	LocalID     string   `json:"localId"`
	Name        string   `json:"name"`
	Image       string   `json:"image,omitempty"`
	Category    string   `json:"category"`
	Illustrator string   `json:"illustrator,omitempty"`
	Rarity      string   `json:"rarity,omitempty"`
	HP          int      `json:"hp,omitempty"`
	Types       []string `json:"types,omitempty"`
	Stage       string   `json:"stage,omitempty"`
	Set         SetBrief `json:"set"`
}

// SetBrief is the abbreviated set info embedded in card responses.
type SetBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Set represents a TCGdex set.
type Set struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Serie       string `json:"serie,omitempty"`
	TCGOnline   string `json:"tcgOnline,omitempty"`
	CardCount   Count  `json:"cardCount"`
	ReleaseDate string `json:"releaseDate,omitempty"`
	Legal       Legal  `json:"legal,omitempty"`
}

// Count holds the card count breakdown for a set.
type Count struct {
	Total    int `json:"total"`
	Official int `json:"official"`
}

// Legal holds format legality flags.
type Legal struct {
	Standard bool `json:"standard"`
	Expanded bool `json:"expanded"`
}

// CardBrief is the abbreviated card info returned in search/list results.
type CardBrief struct {
	ID      string `json:"id"`
	LocalID string `json:"localId"`
	Name    string `json:"name"`
	Image   string `json:"image,omitempty"`
}

// SearchResult wraps a paginated card search response.
type SearchResult struct {
	Data  []CardBrief `json:"data"`
	Page  int         `json:"page"`
	Pages int         `json:"pages"`
	Count int         `json:"count"`
	Total int         `json:"total"`
}
