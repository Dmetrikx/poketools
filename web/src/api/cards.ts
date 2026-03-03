import { api } from './client'
import type { Card, CardBrief } from '@/types/card'

// Promise-based caches: deduplicate in-flight requests and cache successful responses.
// Rejected promises are evicted so transient errors are retried.
const searchCache = new Map<string, Promise<CardBrief[]>>()
const getCache = new Map<string, Promise<Card>>()

export const cardsApi = {
  search: (q: string, set?: string): Promise<CardBrief[]> => {
    const cacheKey = set ? `${q}\x00${set}` : q
    if (!searchCache.has(cacheKey)) {
      const params = new URLSearchParams({ q })
      if (set) params.set('set', set)
      const p = api.get<CardBrief[]>(`/cards/search?${params.toString()}`)
      p.catch(() => searchCache.delete(cacheKey))
      searchCache.set(cacheKey, p)
    }
    return searchCache.get(cacheKey)!
  },

  get: (id: string): Promise<Card> => {
    if (!getCache.has(id)) {
      const p = api.get<Card>(`/cards/${id}`)
      p.catch(() => getCache.delete(id))
      getCache.set(id, p)
    }
    return getCache.get(id)!
  },
}
