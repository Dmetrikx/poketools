import { describe, expect, it } from 'vitest'
import cardsJson from '@/game/catalog/cards.json'
import printsJson from '@/game/catalog/prints.json'
import type { CatalogCard, PrintsIndex } from '@/game/catalog/types'
import type { EntryRef } from '@/game/catalog/resolve'
import { createCanon } from './canon'

const entry = (e: Partial<EntryRef>): EntryRef => ({ name: '', setCode: '', number: '', cardId: '', section: 'trainer', ...e })

describe('createCanon (synthetic)', () => {
  const canon = createCanon({
    prefixes: ['https://img/a/', 'https://cdn/b/'],
    images: { 'AAA-1': '0:1', 'SVP-5': '1:SVP_005.png' },
    prints: { 'AAA-1': 'AAA-1', 'AAA-200': ['AAA-1', '0:200'], 'BBB-3': 'AAA-1', 'aaa01-001': 'AAA-1', 'SVP-5': 'SVP-5' },
    names: { 'nest ball': 'AAA-1' },
  })

  it('prefers the exact print\'s own image', () => {
    expect(canon(entry({ setCode: 'AAA', number: '200', section: 'pokemon' }))).toEqual({ id: 'AAA-1', image: 'https://img/a/200' })
  })

  it('falls back to the canonical image when the print has none', () => {
    expect(canon(entry({ setCode: 'bbb', number: '003', section: 'pokemon' }))).toEqual({ id: 'AAA-1', image: 'https://img/a/1' })
  })

  it('reads PTCG Live promo codes', () => {
    expect(canon(entry({ setCode: 'PR-SV', number: '5', section: 'pokemon' }))?.id).toBe('SVP-5')
  })

  it('tries the stored TCGdex id, then the name for non-Pokémon only', () => {
    expect(canon(entry({ cardId: 'aaa01-001', section: 'pokemon' }))?.id).toBe('AAA-1')
    expect(canon(entry({ name: 'Nest Ball', setCode: 'ZZZ', number: '9' }))?.id).toBe('AAA-1')
    expect(canon(entry({ name: 'Nest Ball', setCode: 'ZZZ', number: '9', section: 'pokemon' }))).toBeNull()
    expect(canon(entry({ name: 'constructor', setCode: 'ZZZ', number: '9' }))).toBeNull()
  })
})

describe('canonical (prints.json)', () => {
  const index = printsJson as unknown as PrintsIndex
  const canon = createCanon(index)
  const cards = cardsJson as CatalogCard[]

  it('gives every catalog card and every print an image', () => {
    for (const c of cards) {
      expect(index.images[c.id], c.id).toBeTruthy()
      for (const pr of c.prints) {
        const [set, number] = [pr.slice(0, pr.lastIndexOf('-')), pr.slice(pr.lastIndexOf('-') + 1)]
        const hit = canon(entry({ setCode: set, number, section: c.kind }))
        expect(hit?.id, pr).toBe(c.id)
        expect(hit?.image, pr).toMatch(/^https:\/\//)
      }
    }
  })

  it('uses the canonical image for a promo TCGdex has no art for', () => {
    const grookey = canon(entry({ name: 'Grookey', setCode: 'MEP', number: '52', section: 'pokemon' }))
    expect(grookey?.id).toBe('MEP-52')
    expect(index.prints['MEP-52']).toBe('MEP-52')
    expect(grookey!.image).toMatch(/limitlesstcg.*MEP_052.*\.png$/)
  })
})
