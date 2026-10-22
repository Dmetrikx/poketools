import { useState, useEffect, useRef, useCallback } from 'react'
import { resolveCard } from '@/api/cards'
import type { CardEntry } from '@/types/deck'

type EntryRef = Pick<CardEntry, 'cardId' | 'name' | 'setCode' | 'number' | 'section' | 'imageUrl'>

/** Stable key used to look up an image for a card entry */
export function imageKey(entry: EntryRef): string {
  return entry.cardId || `${entry.setCode}-${entry.number}`
}

/** Resolve a TCGdex base URL to a full image URL */
export function cardImageUrl(base: string, quality: 'high' | 'low' = 'high'): string {
  if (/\.(webp|png|jpg|jpeg)$/i.test(base)) return base
  return `${base}/${quality}.webp`
}

// Module-level cache: survives component unmount/remount and page navigation.
// Maps imageKey → resolved image URL.
const imageCache = new Map<string, string>()

/**
 * Fetches card images for a list of deck entries: the entry's saved art, or
 * the image of its card as found by resolveCard.
 * Returns [imageMap, overrideImage] where overrideImage(key, url) lets callers
 * manually override the displayed image for a given card (art picker).
 */
export function useCardImages(
  entries: EntryRef[],
): [Map<string, string>, (key: string, url: string) => void] {
  const [imageMap, setImageMap] = useState<Map<string, string>>(() => {
    // Pre-populate from module-level cache so navigating back to a page
    // shows images instantly without re-fetching.
    const initial = new Map<string, string>()
    for (const entry of entries) {
      const key = imageKey(entry)
      const cached = imageCache.get(key)
      if (cached) initial.set(key, cached)
    }
    return initial
  })
  const fetchedRef = useRef<Set<string>>(new Set())

  const overrideImage = useCallback((key: string, url: string) => {
    imageCache.set(key, url)
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
    // Add any newly-cached entries that aren't in local state yet
    const freshFromCache = entries.filter(e => {
      const key = imageKey(e)
      return key && imageCache.has(key) && !fetchedRef.current.has(key)
    })
    if (freshFromCache.length > 0) {
      setImageMap(prev => {
        const next = new Map(prev)
        let changed = false
        for (const e of freshFromCache) {
          const key = imageKey(e)
          const url = imageCache.get(key)!
          if (!prev.has(key)) { next.set(key, url); changed = true }
        }
        return changed ? next : prev
      })
      freshFromCache.forEach(e => fetchedRef.current.add(imageKey(e)))
    }

    const toFetch = entries.filter(e => {
      const key = imageKey(e)
      return key && !fetchedRef.current.has(key) && !imageCache.has(key)
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
        // A picked art wins; otherwise the exact card's image (the server
        // swaps basic energy to a print that has one).
        if (entry.imageUrl) return entry.imageUrl
        return (await resolveCard(entry))?.image
      }

      fetchImage().then(img => {
        if (img) {
          imageCache.set(key, img)
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