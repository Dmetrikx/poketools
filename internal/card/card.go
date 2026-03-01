package card

// Card is the application-level card model, mapped from TCGdex responses.
type Card struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	SetID   string   `json:"setId"`
	SetName string   `json:"setName"`
	Number  string   `json:"number"`
	Types   []string `json:"types,omitempty"`
	HP      int      `json:"hp,omitempty"`
	Rarity  string   `json:"rarity,omitempty"`
	Image   string   `json:"image,omitempty"`
	Stage   string   `json:"stage,omitempty"`
}

// Brief is a lightweight card summary used in search results.
type Brief struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	SetID   string `json:"setId"`
	SetName string `json:"setName"`
	Number  string `json:"number"`
	Image   string `json:"image,omitempty"`
}
