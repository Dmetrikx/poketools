// Patterns many card texts share, built from the effect package.

import cardsJson from '../catalog/cards.json'
import type { CatalogCard } from '../catalog/types'
import {
  chooseCards, choosePokemon, log, matching, moveCards, nameOf, searchDeck, shuffleDeck, type X,
} from './fx'
import type { CardFilter } from '../effects/select'
import type { Proc } from '../engine/types'

const byName = new Map<string, CatalogCard[]>()
for (const c of cardsJson as CatalogCard[]) {
  const list = byName.get(c.name) ?? []
  list.push(c)
  byName.set(c.name, list)
}

/** Catalog cards with this name (several prints / texts). */
export function cardsNamed(name: string): CatalogCard[] {
  return byName.get(name) ?? []
}

/**
 * "Search your deck for an A and a B": one search per filter, each into the
 * hand, then one shuffle.
 */
export function* searchEach(x: X, wants: [CardFilter, string][]): Proc<number[]> {
  const got: number[] = []
  for (const [filter, title] of wants) {
    const [uid] = yield* searchDeck(x, { filter: c => filter(c), title, max: 1 })
    if (uid !== undefined) {
      moveCards(x, [uid], 'hand')
      got.push(uid)
    }
  }
  if (got.length) log(x, x.me, `Puts ${got.map(u => nameOf(x, u)).join(', ')} into their hand.`)
  shuffleDeck(x, x.me)
  return got
}

/** Cards from your discard pile that pass the filter, up to max, into your hand (or deck). */
export function* fromDiscard(x: X, o: { filter: CardFilter; max: number; min?: number; title: string; to?: 'hand' | 'deck' }): Proc<number[]> {
  const options = matching(x, x.s.players[x.me].discard, o.filter)
  const picks = yield* chooseCards(x, { title: o.title, options, min: o.min ?? 0, max: o.max })
  if (o.to === 'deck') {
    moveCards(x, picks, 'deckBottom')
    shuffleDeck(x, x.me)
  } else {
    moveCards(x, picks, 'hand')
  }
  if (picks.length) log(x, x.me, `Puts ${picks.map(u => nameOf(x, u)).join(', ')} into their ${o.to ?? 'hand'}.`)
  return picks
}

/** Has the discard pile any card passing the filter? */
export function inDiscard(x: X, f: CardFilter): boolean {
  return matching(x, x.s.players[x.me].discard, f).length > 0
}

/** One of your Pokémon (or `options`), or null when none qualify. */
export function* pickOne(x: X, title: string, options: X['self'][]): Proc<NonNullable<X['self']> | null> {
  const slots = options.filter((s): s is NonNullable<typeof s> => !!s)
  const [slot] = yield* choosePokemon(x, { title, options: slots })
  return slot ?? null
}
