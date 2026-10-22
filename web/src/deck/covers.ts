import { imageKey } from '@/hooks/useCardImages'
import type { CardEntry } from '@/types/deck'

/** How many cards a deck shows as its cover (deck.MaxCovers on the server). */
export const MAX_COVERS = 2

/**
 * Fills the empty cover slots after `current`: the highest-HP Pokémon first
 * (ties by count, then deck position), then any other card by count. Cards
 * already shown, or sharing an image with one that is, are skipped.
 */
export function fillCovers(
  current: CardEntry[],
  entries: CardEntry[],
  hpByKey: Map<string, number>,
): CardEntry[] {
  const covers = current.slice(0, MAX_COVERS)
  const taken = new Set(covers.map(imageKey))

  const hp = (e: CardEntry) => hpByKey.get(imageKey(e)) ?? 0
  const byHP = (a: CardEntry, b: CardEntry) =>
    hp(b) - hp(a) || b.count - a.count || a.position - b.position
  const byCount = (a: CardEntry, b: CardEntry) => b.count - a.count || a.position - b.position

  const candidates = [
    ...entries.filter(e => e.section === 'pokemon').sort(byHP),
    ...entries.filter(e => e.section !== 'pokemon').sort(byCount),
  ]
  for (const e of candidates) {
    if (covers.length >= MAX_COVERS) break
    const key = imageKey(e)
    if (taken.has(key)) continue
    taken.add(key)
    covers.push(e)
  }
  return covers
}

/** Covers with `entry` in `slot`; if it was already in the other slot, the two swap. */
export function withCover(covers: CardEntry[], slot: number, entry: CardEntry): CardEntry[] {
  const existing = covers.findIndex(c => c.id === entry.id)
  // An empty slot: add the card unless it's already shown.
  if (slot >= covers.length) {
    return existing === -1 ? [...covers, entry].slice(0, MAX_COVERS) : covers
  }
  const next = covers.slice()
  if (existing !== -1) next[existing] = next[slot]
  next[slot] = entry
  return next
}
