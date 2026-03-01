import { useState, useEffect, useRef, useCallback } from 'react'
import { cardsApi } from '@/api/cards'
import type { CardEntry } from '@/types/deck'

type EntryRef = Pick<CardEntry, 'cardId' | 'name' | 'setCode' | 'number'>

/** Stable key used to look up an image for a card entry */
export function imageKey(entry: EntryRef): string {
  return entry.cardId || `${entry.setCode}-${entry.number}`
}

/** Resolve a TCGdex base URL to a full image URL */
export function cardImageUrl(base: string, quality: 'high' | 'low' = 'high'): string {
  if (/\.(webp|png|jpg|jpeg)$/i.test(base)) return base
  return `${base}/${quality}.webp`
}

/**
 * Fetches card images for a list of deck entries.
 * - If cardId is set, fetches via GET /api/cards/{id}
 * - Otherwise searches by name + setCode; if that fails (502) or returns empty,
 *   retries without the set and picks the first result with an exact name match.
 * Returns [imageMap, overrideImage] where overrideImage(key, url) lets callers
 * manually override the displayed image for a given card (art picker).
 */
export function useCardImages(
  entries: EntryRef[],
): [Map<string, string>, (key: string, url: string) => void] {
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map())
  const fetchedRef = useRef<Set<string>>(new Set())

  const overrideImage = useCallback((key: string, url: string) => {
    setImageMap(prev => {
      const next = new Map(prev)
      next.set(key, url)
      return next
    })
  }, [])

  const depsKey = entries
    .map(e => imageKey(e))
    .sort()
    .join('\x00')

  useEffect(() => {
    const toFetch = entries.filter(e => {
      const key = imageKey(e)
      return key && !fetchedRef.current.has(key)
    })
    if (toFetch.length === 0) return

    // Deduplicate by key
    const seen = new Set<string>()
    const unique = toFetch.filter(e => {
      const key = imageKey(e)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    unique.forEach(entry => {
      const key = imageKey(entry)
      fetchedRef.current.add(key)

      const fetchImage = async (): Promise<string | undefined> => {
        if (entry.cardId) {
          const card = await cardsApi.get(entry.cardId)
          return card.image
        }

        // Try search with set first
        if (entry.setCode) {
          try {
            const results = await cardsApi.search(entry.name, entry.setCode)
            if (results.length > 0) return results[0].image
          } catch {
            // 502 or other — fall through to name-only retry
          }
        }

        // Fallback: search by name only, pick first exact name match
        const nameLower = entry.name.toLowerCase()
        const fallback = await cardsApi.search(entry.name)
        const match = fallback.find(r => r.name.toLowerCase() === nameLower)
        return match?.image ?? fallback[0]?.image
      }

      fetchImage().then(img => {
        if (img) {
          setImageMap(prev => {
            const next = new Map(prev)
            next.set(key, img)
            return next
          })
        }
      }).catch(() => { /* silently skip cards not found in TCGdex */ })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  return [imageMap, overrideImage]
}