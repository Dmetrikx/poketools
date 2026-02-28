package tcgdex

import (
	"sync"
	"time"
)

type cacheEntry struct {
	value     any
	expiresAt time.Time
}

// cache is a simple in-memory TTL cache.
type cache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

func newCache(ttl time.Duration) *cache {
	c := &cache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
	}
	go c.evictLoop()
	return c
}

func (c *cache) get(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

func (c *cache) set(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *cache) evictLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, e := range c.entries {
			if now.After(e.expiresAt) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}
