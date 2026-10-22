import { api, ApiError } from './client'
import type { Card, CardBrief } from '@/types/card'
import type { CardEntry } from '@/types/deck'

// Promise-based caches: deduplicate in-flight requests and cache successful responses.
// Rejected promises are evicted so transient errors are retried.
const searchCache = new Map<string, Promise<CardBrief[]>>()
const getCache = new Map<string, Promise<Card>>()
const resolveCache = new Map<string, Promise<string | undefined>>()

type EntryRef = Pick<CardEntry, 'cardId' | 'name' | 'setCode' | 'number'>

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

  /** TCGdex card ID for a decklist line's set code + number; undefined if none. */
  resolve: (entry: EntryRef): Promise<string | undefined> => {
    const cacheKey = `${entry.setCode}\x00${entry.number}\x00${entry.name}`
    if (!resolveCache.has(cacheKey)) {
      const params = new URLSearchParams({ set: entry.setCode, number: entry.number, name: entry.name })
      const p = api.get<{ id: string }>(`/cards/resolve?${params.toString()}`)
        .then(r => r.id)
        .catch(err => {
          // 404 means no match: cache that. Anything else is retried next time.
          if (err instanceof ApiError && err.status === 404) return undefined
          resolveCache.delete(cacheKey)
          throw err
        })
      resolveCache.set(cacheKey, p)
    }
    return resolveCache.get(cacheKey)!
  },
}

/**
 * Full TCGdex card for a deck entry. Imports store the exact cardId; entries
 * saved before that are resolved by the server from set code + number. Only
 * when that fails (a set code TCGdex doesn't know) does this guess by name,
 * preferring an exact match. Resolves undefined when nothing matches.
 */
export async function resolveCard(entry: EntryRef): Promise<Card | undefined> {
  let id: string | undefined = entry.cardId
  if (!id && entry.setCode) {
    id = await cardsApi.resolve(entry).catch(() => undefined)
  }
  if (!id) {
    const results = await cardsApi.search(entry.name).catch(() => [])
    const nameLower = entry.name.toLowerCase()
    id = (results.find(r => r.name.toLowerCase() === nameLower) ?? results[0])?.id
  }
  return id ? cardsApi.get(id) : undefined
}
