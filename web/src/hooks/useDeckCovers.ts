import { useState, useEffect, useRef, useCallback } from 'react'
import { decksApi } from '@/api/decks'
import { resolveCard } from '@/api/cards'
import { imageKey } from '@/hooks/useCardImages'
import { MAX_COVERS, fillCovers, withCover } from '@/deck/covers'
import type { CardEntry } from '@/types/deck'

const ids = (covers: CardEntry[]) => covers.map(c => c.id).join(',')

/**
 * A deck's cover cards. Saved covers are used as they are; empty slots are
 * filled with the default pick (highest-HP Pokémon) and saved, so each deck
 * is only worked out once. Pass `entries` when the deck is already loaded;
 * without them the deck is fetched only if a slot needs filling. `saved` is
 * undefined while the deck itself is still loading.
 */
export function useDeckCovers(deckId: string, saved: CardEntry[] | null | undefined, entries?: CardEntry[]) {
  const [covers, setCovers] = useState<CardEntry[]>(saved ?? [])
  const [loading, setLoading] = useState((saved?.length ?? 0) < MAX_COVERS)
  const coversRef = useRef(covers)
  const savedIds = useRef(ids(saved ?? []))
  const seeded = useRef(saved !== undefined)

  const apply = useCallback((next: CardEntry[]) => {
    coversRef.current = next
    setCovers(next)
  }, [])

  const persist = useCallback((next: CardEntry[]) => {
    if (ids(next) === savedIds.current) return
    savedIds.current = ids(next)
    decksApi.setCovers(deckId, next.map(c => c.id)).catch(() => {
      // Not saved: the default is worked out again next time
    })
  }, [deckId])

  const entriesKey = entries?.map(e => e.id).join(',')

  useEffect(() => {
    if (saved === undefined) return
    if (!seeded.current) {
      seeded.current = true
      coversRef.current = saved ?? []
      savedIds.current = ids(saved ?? [])
    }

    let cancelled = false
    const run = async () => {
      const all = entries
        ?? (coversRef.current.length >= MAX_COVERS ? undefined : (await decksApi.get(deckId)).entries ?? [])
      if (cancelled) return
      if (!all) {
        setLoading(false)
        return
      }

      // Drop covers whose entry is gone (the server has already dropped them).
      const inDeck = new Set(all.map(e => e.id))
      const current = coversRef.current.filter(c => inDeck.has(c.id))
      if (current.length >= MAX_COVERS || current.length === all.length) {
        apply(current)
        setLoading(false)
        return
      }

      const hpByKey = new Map<string, number>()
      await Promise.all(
        all.filter(e => e.section === 'pokemon').map(async e => {
          const card = await resolveCard(e).catch(() => undefined)
          if (card?.hp) hpByKey.set(imageKey(e), card.hp)
        }),
      )
      if (cancelled) return

      const next = fillCovers(current, all, hpByKey)
      apply(next)
      setLoading(false)
      persist(next)
    }
    run().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, entriesKey, saved === undefined])

  /** Puts `entry` in `slot` and saves it. */
  const chooseCover = useCallback((slot: number, entry: CardEntry) => {
    const next = withCover(coversRef.current, slot, entry)
    apply(next)
    persist(next)
  }, [apply, persist])

  return { covers, loading, chooseCover }
}
