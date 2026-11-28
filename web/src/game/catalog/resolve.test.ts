import { describe, expect, it } from 'vitest'
import cardsJson from './cards.json'
import aliasesJson from './aliases.json'
import decksJson from './fixtures/decks.json'
import statsJson from './fixtures/pool-stats.json'
import laicIds from './fixtures/laic-ids.json'
import printsJson from './prints.json'
import { createCatalog, normalizeName, printKey, resolveEntry, type EntryRef } from './resolve'
import type { Aliases, CatalogCard, FixtureDeck, PrintsIndex } from './types'

const cards = cardsJson as CatalogCard[]
const catalog = createCatalog(cards, aliasesJson as Aliases)
const decks = decksJson as FixtureDeck[]

const entry = (e: Partial<EntryRef>): EntryRef => ({ name: '', setCode: '', number: '', cardId: '', section: 'trainer', ...e })

const kindOf = (c: CatalogCard) => (c.kind === 'pokemon' ? 'pokemon' : c.kind === 'energy' ? `${c.subtype} Energy` : c.subtype)

describe('catalog', () => {
  it('matches the build stats', () => {
    expect(cards).toHaveLength(statsJson.total)
    const totals: Record<string, number> = {}
    for (const c of cards) totals[kindOf(c)] = (totals[kindOf(c)] ?? 0) + 1
    expect(totals).toEqual(Object.fromEntries(Object.entries(statsJson.totals).filter(([, n]) => n > 0)))
    expect(decks).toHaveLength(36)
  })

  it('keeps every LAIC id', () => {
    const ids = new Set(cards.map(c => c.id))
    expect((laicIds as string[]).filter(id => !ids.has(id))).toEqual([])
  })

  it('gives every card an image', () => {
    for (const c of cards) expect(c.image, c.id).toMatch(/^https:\/\//)
  })

  it('knows the reprints of common trainers', () => {
    for (const name of ["Boss's Orders", 'Ultra Ball']) expect(cards.find(c => c.name === name)!.prints.length, name).toBeGreaterThan(1)
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

  it('resolves every alternate print to the same card as the main print', () => {
    for (const c of cards) {
      for (const pr of c.prints) {
        const i = pr.lastIndexOf('-')
        expect(resolveEntry(catalog, entry({ name: c.name, setCode: pr.slice(0, i), number: pr.slice(i + 1), section: c.kind }))?.id, pr).toBe(c.id)
      }
    }
  })

  it('resolves a reprinted trainer by print', () => {
    const boss = cards.find(c => c.name === "Boss's Orders")!
    expect(boss.prints).toContain('RCL-154')
    expect(resolveEntry(catalog, entry({ name: "Boss's Orders", setCode: 'RCL', number: '154' }))?.id).toBe(boss.id)
  })

  it('keeps a same-name Pokémon with other text apart', () => {
    const slowpokes = cards.filter(c => c.name === 'Slowpoke')
    expect(slowpokes.length).toBeGreaterThan(1)
    expect(resolveEntry(catalog, entry({ name: 'Slowpoke', setCode: 'PBL', number: '29', section: 'pokemon' }))?.id).toBe('PBL-29')
    for (const s of slowpokes.filter(s => s.id !== 'PBL-29')) expect(s.prints).not.toContain('PBL-29')
  })

  it('reads PTCG Live promo set codes', () => {
    expect(printKey('PR-SV', '050')).toBe('SVP-50')
    expect(printKey('pr-sw', '251')).toBe('SP-251')
  })

  it('maps every prints.json key to a catalog card', () => {
    const index = printsJson as unknown as PrintsIndex
    for (const [key, hit] of Object.entries(index.prints)) expect(catalog.cards.has(typeof hit === 'string' ? hit : hit[0]), key).toBe(true)
    for (const id of Object.values(index.names)) expect(catalog.cards.has(id), id).toBe(true)
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
