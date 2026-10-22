import { api } from './client'
import type { Card, CardBrief } from '@/types/card'
import type { CardEntry } from '@/types/deck'

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

/**
 * Full TCGdex card for a deck entry. PTCG Live set codes don't match TCGdex
 * IDs, so without a stored cardId this searches by name + set, then by name,
 * preferring an exact name match. Resolves undefined when nothing matches.
 */
export async function resolveCard(
  entry: Pick<CardEntry, 'cardId' | 'name' | 'setCode'>,
): Promise<Card | undefined> {
  let id = entry.cardId
  if (!id) {
    let results = await cardsApi.search(entry.name, entry.setCode).catch(() => [])
    if (!results.length) {
      results = await cardsApi.search(entry.name).catch(() => [])
    }
    const nameLower = entry.name.toLowerCase()
    id = (results.find(r => r.name.toLowerCase() === nameLower) ?? results[0])?.id
  }
  return id ? cardsApi.get(id) : undefined
}
