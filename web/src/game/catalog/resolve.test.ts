import { describe, expect, it } from 'vitest'
import cardsJson from './cards.json'
import aliasesJson from './aliases.json'
import decksJson from './fixtures/decks.json'
import statsJson from './fixtures/pool-stats.json'
import { createCatalog, normalizeName, printKey, resolveEntry, type EntryRef } from './resolve'
import type { Aliases, CatalogCard, FixtureDeck } from './types'

const cards = cardsJson as CatalogCard[]
const catalog = createCatalog(cards, aliasesJson as Aliases)
const decks = decksJson as FixtureDeck[]

const entry = (e: Partial<EntryRef>): EntryRef => ({ name: '', setCode: '', number: '', cardId: '', section: 'trainer', ...e })

describe('catalog', () => {
  it('has the planned pool', () => {
    expect(cards).toHaveLength(342)
    expect(statsJson.totals).toEqual({
      pokemon: 201, Supporter: 46, Item: 43, Tool: 12, Stadium: 19, 'Basic Energy': 8, 'Special Energy': 13,
    })
    expect(decks).toHaveLength(36)
  })

  it('has unique ids, each its own alias', () => {
    expect(new Set(cards.map(c => c.id)).size).toBe(cards.length)
    for (const c of cards) expect(catalog.aliases.get(printKey(...c.id.split('-') as [string, string]))).toBe(c.id)
  })

  it('gives every Pokémon its stats', () => {
    for (const c of cards.filter(c => c.kind === 'pokemon')) {
      expect(c.hp, c.id).toBeGreaterThan(0)
      expect(c.types?.length, c.id).toBeGreaterThan(0)
      expect(['Basic', 'Stage 1', 'Stage 2'], c.id).toContain(c.subtype)
      expect(c.attacks!.length + c.abilities!.length, c.id).toBeGreaterThan(0)
      if (c.subtype !== 'Basic') expect(c.evolveFrom, c.id).toBeTruthy()
    }
  })

  it('gives every trainer and special energy its text', () => {
    for (const c of cards.filter(c => c.kind === 'trainer' || c.subtype === 'Special')) expect(c.text, c.id).toBeTruthy()
  })
})

describe('resolveEntry', () => {
  it('resolves every fixture deck to 60 catalog cards', () => {
    for (const deck of decks) {
      let n = 0
      for (const c of deck.cards) {
        const card = resolveEntry(catalog, entry({ name: c.name, setCode: c.set, number: c.number, section: c.kind }))
        expect(card, `${deck.archetype}: ${c.name} ${c.set} ${c.number}`).not.toBeNull()
        expect(card!.kind).toBe(c.kind)
        n += c.count
      }
      expect(n, deck.archetype).toBe(60)
    }
  })

  it('matches a print with a zero-padded number', () => {
    const c = cards.find(c => c.kind === 'pokemon')!
    const [set, number] = c.id.split('-')
    expect(resolveEntry(catalog, entry({ setCode: set.toLowerCase(), number: number.padStart(3, '0'), section: 'pokemon' }))?.id).toBe(c.id)
  })

  it('matches a stored TCGdex id', () => {
    const c = cards.find(c => c.kind === 'pokemon' && c.tcgdexId)!
    expect(resolveEntry(catalog, entry({ cardId: c.tcgdexId, section: 'pokemon' }))?.id).toBe(c.id)
  })

  it('falls back to the name for trainers and energy', () => {
    const ball = cards.find(c => c.name === 'Ultra Ball')!
    expect(resolveEntry(catalog, entry({ name: 'Ultra Ball', setCode: 'XXX', number: '1' }))?.id).toBe(ball.id)
    const fire = cards.find(c => c.name === 'Fire Energy')!
    expect(resolveEntry(catalog, entry({ name: 'Basic {R} Energy', setCode: 'SVE', number: '2', section: 'energy' }))?.id).toBe(fire.id)
  })

  it('never resolves a Pokémon by name alone', () => {
    const p = cards.find(c => c.kind === 'pokemon')!
    expect(resolveEntry(catalog, entry({ name: p.name, setCode: 'XXX', number: '1', section: 'pokemon' }))).toBeNull()
  })
})

describe('normalizeName', () => {
  it('ignores accents, quotes and case', () => {
    expect(normalizeName('Poké Pad')).toBe(normalizeName('Poke Pad'))
    expect(normalizeName('Boss’s Orders')).toBe(normalizeName("boss's orders"))
  })
})
