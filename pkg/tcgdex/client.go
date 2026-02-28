// Package tcgdex provides an HTTP client for the TCGdex API (https://tcgdex.dev).
package tcgdex

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const defaultBaseURL = "https://api.tcgdex.net/v2"

// Client is a TCGdex API client.
type Client struct {
	baseURL    string
	lang       string
	httpClient *http.Client
	cache      *cache
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the API base URL.
func WithBaseURL(u string) Option {
	return func(c *Client) { c.baseURL = u }
}

// WithLang sets the language for API responses (default: "en").
func WithLang(lang string) Option {
	return func(c *Client) { c.lang = lang }
}

// WithCacheTTL sets the in-memory cache TTL (default: 15 minutes).
func WithCacheTTL(ttl time.Duration) Option {
	return func(c *Client) { c.cache = newCache(ttl) }
}

func New(opts ...Option) *Client {
	c := &Client{
		baseURL:    defaultBaseURL,
		lang:       "en",
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cache:      newCache(15 * time.Minute),
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// GetCard fetches a single card by its TCGdex ID (e.g. "swsh1-1").
func (c *Client) GetCard(ctx context.Context, id string) (*Card, error) {
	cacheKey := "card:" + id
	if v, ok := c.cache.get(cacheKey); ok {
		return v.(*Card), nil
	}

	var card Card
	if err := c.get(ctx, fmt.Sprintf("/%s/cards/%s", c.lang, id), &card); err != nil {
		return nil, err
	}
	c.cache.set(cacheKey, &card)
	return &card, nil
}

// SearchCards searches cards by name and optional set filter.
// Returns a slice of CardBrief results.
func (c *Client) SearchCards(ctx context.Context, query, setID string) ([]CardBrief, error) {
	cacheKey := fmt.Sprintf("search:%s:%s", query, setID)
	if v, ok := c.cache.get(cacheKey); ok {
		return v.([]CardBrief), nil
	}

	params := url.Values{}
	if query != "" {
		params.Set("name", query)
	}
	if setID != "" {
		params.Set("set", setID)
	}

	path := fmt.Sprintf("/%s/cards", c.lang)
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	// TCGdex returns []CardBrief directly for filtered list calls.
	var results []CardBrief
	if err := c.get(ctx, path, &results); err != nil {
		return nil, err
	}
	c.cache.set(cacheKey, results)
	return results, nil
}

// GetSet fetches a single set by ID.
func (c *Client) GetSet(ctx context.Context, id string) (*Set, error) {
	cacheKey := "set:" + id
	if v, ok := c.cache.get(cacheKey); ok {
		return v.(*Set), nil
	}

	var set Set
	if err := c.get(ctx, fmt.Sprintf("/%s/sets/%s", c.lang, id), &set); err != nil {
		return nil, err
	}
	c.cache.set(cacheKey, &set)
	return &set, nil
}

// ListSets returns all available sets.
func (c *Client) ListSets(ctx context.Context) ([]SetBrief, error) {
	cacheKey := "sets:all"
	if v, ok := c.cache.get(cacheKey); ok {
		return v.([]SetBrief), nil
	}

	var sets []SetBrief
	if err := c.get(ctx, fmt.Sprintf("/%s/sets", c.lang), &sets); err != nil {
		return nil, err
	}
	c.cache.set(cacheKey, sets)
	return sets, nil
}

// ── Internal ─────────────────────────────────────────────────────────────────

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("not found: %s", path)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, body)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}
