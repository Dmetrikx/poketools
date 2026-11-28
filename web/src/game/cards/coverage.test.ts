import { describe, expect, it } from 'vitest'
import cardsJson from '../catalog/cards.json'
import aliasesJson from '../catalog/aliases.json'
import decksJson from '../catalog/fixtures/decks.json'
import { createCatalog, resolveEntry } from '../catalog/resolve'
import type { Aliases, CatalogCard, FixtureDeck } from '../catalog/types'
import { catalogEffects } from './effectKeys'
import { registeredEffects } from './index'
import { pending } from './pending'
import { PRIMITIVES } from './taxonomy'

/** Cards played in at most this many lists may wait in pending.ts; the rest must be implemented. */
const PENDING_MAX_LISTS = 4

const effects = catalogEffects(cardsJson as CatalogCard[])
const catalog = createCatalog(cardsJson as CatalogCard[], aliasesJson as Aliases)
const registered = registeredEffects()
const pendingKeys = Object.keys(pending)

const cards = cardsJson as CatalogCard[]
const pendingIds = new Set(pendingKeys.map(k => k.split('#')[0]))

describe('card coverage', () => {
  it('every card played in 5+ lists is implemented', () => {
    const common = cards.filter(c => c.lists > PENDING_MAX_LISTS).map(c => c.id)
    expect(common.filter(id => pendingIds.has(id))).toEqual([])
  })

  it('no fixture deck contains a pending card', () => {
    const inFixtures = new Set<string>()
    for (const deck of decksJson as FixtureDeck[]) {
      for (const c of deck.cards) {
        const card = resolveEntry(catalog, { name: c.name, setCode: c.set, number: c.number, cardId: '', section: c.kind })
        if (card) inFixtures.add(card.id)
      }
    }
    expect([...inFixtures].filter(id => pendingIds.has(id))).toEqual([])
  })

  it('every catalog effect is implemented or pending', () => {
    const missing = effects.filter(k => !registered.has(k) && !(k in pending))
    expect(missing).toEqual([])
  })

  it('nothing is both implemented and pending', () => {
    expect(pendingKeys.filter(k => registered.has(k))).toEqual([])
  })

  it('pending and registered keys all exist in the catalog', () => {
    const known = new Set(effects)
    expect(pendingKeys.filter(k => !known.has(k))).toEqual([])
    expect([...registered].filter(k => !known.has(k))).toEqual([])
  })

  it('every pending effect is classified into known primitives', () => {
    for (const [key, prims] of Object.entries(pending)) {
      expect(prims.length, key).toBeGreaterThan(0)
      for (const p of prims) expect(PRIMITIVES, key).toHaveProperty(p)
    }
  })
})
