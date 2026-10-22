import type { CardEntry, Section } from '@/types/deck'

/** One physical card in a shuffled deck. `uid` is stable for the life of a hand. */
export interface DealtCard {
  uid: number
  entry: CardEntry
}

export interface Hand {
  hand: DealtCard[]
  prizes: DealtCard[]
  nextCard: DealtCard | null
  deck: DealtCard[]
  mulligans: number
}

const MAX_MULLIGANS = 500

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let j = out.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [out[j], out[k]] = [out[k], out[j]]
  }
  return out
}

/**
 * Shuffles the deck and deals 7 cards, mulliganing until the hand holds a
 * basic Pokémon (capped so a deck without basics still produces a hand).
 * Then 6 prizes, the next card, and the remaining deck in order.
 */
export function dealHand(entries: CardEntry[], isBasic: (entry: CardEntry) => boolean): Hand {
  const pool: DealtCard[] = entries
    .flatMap(e => Array<CardEntry>(e.count).fill(e))
    .map((entry, uid) => ({ uid, entry }))

  let mulligans = 0
  let shuffled = shuffle(pool)
  while (!shuffled.slice(0, 7).some(c => isBasic(c.entry)) && mulligans < MAX_MULLIGANS) {
    mulligans++
    shuffled = shuffle(pool)
  }

  return {
    hand: shuffled.slice(0, 7),
    prizes: shuffled.slice(7, 13),
    nextCard: shuffled[13] ?? null,
    deck: shuffled.slice(14),
    mulligans,
  }
}

const SECTION_ORDER: Record<Section, number> = { pokemon: 0, trainer: 1, energy: 2 }

/** Deck order for checking answers: by section, then name. */
export function sortCards(cards: DealtCard[]): DealtCard[] {
  return [...cards].sort((a, b) =>
    SECTION_ORDER[a.entry.section] - SECTION_ORDER[b.entry.section] ||
    a.entry.name.localeCompare(b.entry.name) ||
    a.uid - b.uid
  )
}

/** Changes whenever the deck's contents change, to invalidate a stored hand. */
export function deckSignature(entries: CardEntry[]): string {
  return entries.map(e => `${e.id}:${e.count}`).sort().join(',')
}
