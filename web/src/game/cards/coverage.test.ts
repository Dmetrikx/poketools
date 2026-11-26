import { describe, expect, it } from 'vitest'
import cardsJson from '../catalog/cards.json'
import type { CatalogCard } from '../catalog/types'
import { catalogEffects } from './effectKeys'
import { registeredEffects } from './index'
import { pending } from './pending'
import { PRIMITIVES } from './taxonomy'

const effects = catalogEffects(cardsJson as CatalogCard[])
const registered = registeredEffects()
const pendingKeys = Object.keys(pending)

describe('card coverage', () => {
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
