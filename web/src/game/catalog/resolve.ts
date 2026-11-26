import type { CardEntry } from '@/types/deck'
import type { Aliases, CatalogCard, EnergyType } from './types'

export interface Catalog {
  cards: Map<string, CatalogCard>
  /** Normalized `SET-number` and exact TCGdex id → catalog id. */
  aliases: Map<string, string>
  /** Normalized name → trainer or energy card. Pokémon never resolve by name. */
  byName: Map<string, CatalogCard>
}

export type EntryRef = Pick<CardEntry, 'name' | 'setCode' | 'number' | 'cardId' | 'section'>

/** `SET-number` with the set upper-cased and a numeric number unpadded: "svi", "007" → "SVI-7". */
export function printKey(set: string, number: string): string {
  const n = number.trim().toUpperCase()
  return `${set.trim().toUpperCase()}-${/^\d+$/.test(n) ? String(Number(n)) : n}`
}

const SYMBOLS: Record<string, EnergyType> = {
  G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting',
  D: 'Darkness', M: 'Metal', N: 'Dragon', Y: 'Fairy', C: 'Colorless',
}

/**
 * Name comparison form: accents, quote styles, case and spacing ignored, and
 * PTCG Live's "Basic {R} Energy" read as "Fire Energy".
 */
export function normalizeName(name: string): string {
  const s = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ').trim()
  const basic = /^Basic \{?([A-Za-z]+)\}? Energy$/i.exec(s)
  const plain = basic ? `${SYMBOLS[basic[1].toUpperCase()] ?? basic[1]} Energy` : s
  return plain.toLowerCase()
}

export function createCatalog(cards: CatalogCard[], aliases: Aliases): Catalog {
  const byId = new Map(cards.map(c => [c.id, c]))
  const alias = new Map<string, string>()
  for (const [key, id] of Object.entries(aliases)) {
    const m = /^([A-Z0-9]+)-([A-Za-z0-9]+)$/.exec(key)
    alias.set(m ? printKey(m[1], m[2]) : key, id)
  }
  const byName = new Map<string, CatalogCard>()
  for (const c of cards) if (c.kind !== 'pokemon') byName.set(normalizeName(c.name), c)
  return { cards: byId, aliases: alias, byName }
}

/**
 * The catalog card for a deck entry, or null when the pool doesn't have it.
 * Tries the print (`SET-number`), then the stored TCGdex id, then, for
 * trainers and energy only, the name: same-name Pokémon can have different
 * text, so a Pokémon has to match by print.
 */
export function resolveEntry(catalog: Catalog, entry: EntryRef): CatalogCard | null {
  const candidates = [
    entry.setCode && entry.number ? printKey(entry.setCode, entry.number) : '',
    entry.cardId,
  ]
  for (const key of candidates) {
    const id = key ? catalog.aliases.get(key) : undefined
    if (id) return catalog.cards.get(id) ?? null
  }
  if (entry.section === 'pokemon') return null
  return catalog.byName.get(normalizeName(entry.name)) ?? null
}

let loading: Promise<Catalog> | null = null

/** The full catalog, loaded as its own chunk on first use. */
export function loadCatalog(): Promise<Catalog> {
  loading ??= Promise.all([import('./cards.json'), import('./aliases.json')])
    .then(([cards, aliases]) => createCatalog(cards.default as CatalogCard[], aliases.default as Aliases))
  return loading
}
