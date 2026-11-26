// Test helpers: catalog and synthetic card databases, and `scenario`, which
// builds a mid-game state directly so a rule or card can be tested without
// playing up to it.

import { resolveEntry } from '../catalog/resolve'
import type { CatalogAttack, CatalogCard, EnergyType, FixtureDeck } from '../catalog/types'
import { catalog, dbFrom, gameDb } from '../db'
import { initialState } from './game'
import type { CardImpl, Effectful, Impls, MarkerImpl } from './impl'
import { newSlot } from './rules'
import type { GameState, PlayerId, Rotation, Slot } from './types'

export { catalog, dbFrom }

/** Impls from plain maps, for tests with synthetic cards. */
export function implsFrom(cards: Record<string, CardImpl>, markers: Record<string, MarkerImpl> = {}, rules: Effectful[] = []): Impls {
  return { card: id => cards[id], marker: k => markers[k], rules: () => rules }
}

/** The real catalog with every registered card definition. */
export const catalogDb = gameDb

/** A fixture deck as 60 catalog ids. */
export function fixtureDeck(deck: FixtureDeck): string[] {
  return deck.cards.flatMap(c => {
    const card = resolveEntry(catalog, { name: c.name, setCode: c.set, number: c.number, cardId: '', section: c.kind })
    if (!card) throw new Error(`${deck.archetype}: ${c.name} doesn't resolve`)
    return Array<string>(c.count).fill(card.id)
  })
}

// ── synthetic cards ──────────────────────────────────────────────────────

export function attack(name: string, cost: EnergyType[], damage: string | number, text = ''): CatalogAttack {
  return { name, cost, damage: String(damage), text }
}

export function pokemon(id: string, p: Partial<CatalogCard> & { hp: number }): CatalogCard {
  return {
    id, name: p.name ?? id, kind: 'pokemon', subtype: p.subtype ?? 'Basic', types: ['Colorless'],
    attacks: [], abilities: [], weakness: null, resistance: null, retreat: 1, tags: [], prints: [id], lists: 0, ...p,
  }
}

export function energy(type: EnergyType): CatalogCard {
  return { id: `E-${type}`, name: `${type} Energy`, kind: 'energy', subtype: 'Basic', energyType: type, tags: [], prints: [], lists: 0 }
}

export function trainer(id: string, subtype: 'Item' | 'Supporter' | 'Tool' | 'Stadium', text = ''): CatalogCard {
  return { id, name: id, kind: 'trainer', subtype, text, tags: [], prints: [id], lists: 0 }
}

// ── scenario ─────────────────────────────────────────────────────────────

export type PokemonSpec = string | {
  card: string
  /** Lower stages, bottom first, under `card`. */
  under?: string[]
  energy?: string[]
  tools?: string[]
  damage?: number
  rotation?: Rotation
  poisoned?: boolean
  burned?: boolean
  /** Turn it came into play (defaults to before this turn). */
  entered?: number
}

export interface SideSpec {
  active?: PokemonSpec
  bench?: PokemonSpec[]
  hand?: string[]
  deck?: string[]
  discard?: string[]
  /** Prize cards, or how many filler prizes. Defaults to 6. */
  prizes?: string[] | number
}

export interface ScenarioSpec {
  p0?: SideSpec
  p1?: SideSpec
  stadium?: string
  turn?: number
  turnPlayer?: PlayerId
  firstPlayer?: PlayerId
  seed?: number
  /** Card used to fill decks and prizes (defaults to the first energy id given). */
  filler: string
}

/**
 * A state in the main phase with exactly the given zones. Decks default to
 * 20 filler cards. `uidOf(name)` style lookups are left to the test: zones
 * keep the order given.
 */
export function scenario(spec: ScenarioSpec): GameState {
  const s = initialState({ seed: spec.seed ?? 1, decks: [[], []] })
  const add = (owner: PlayerId, cardId: string) => {
    s.cards.push({ owner, cardId })
    return s.cards.length - 1
  }
  const turn = spec.turn ?? 3
  const place = (owner: PlayerId, ps: PokemonSpec): Slot => {
    const p = typeof ps === 'string' ? { card: ps } : ps
    const stack = [...(p.under ?? []), p.card].map(id => add(owner, id))
    const slot = newSlot(stack[0], p.entered ?? turn - 2)
    slot.stack = stack
    slot.energy = (p.energy ?? []).map(id => add(owner, id))
    slot.tools = (p.tools ?? []).map(id => add(owner, id))
    slot.damage = p.damage ?? 0
    slot.rotation = p.rotation ?? null
    slot.poisoned = !!p.poisoned
    slot.burned = !!p.burned
    return slot
  }
  for (const owner of [0, 1] as PlayerId[]) {
    const side = (owner === 0 ? spec.p0 : spec.p1) ?? {}
    const pl = s.players[owner]
    pl.active = side.active ? place(owner, side.active) : null
    pl.bench = (side.bench ?? []).map(b => place(owner, b))
    pl.hand = (side.hand ?? []).map(id => add(owner, id))
    pl.deck = (side.deck ?? Array<string>(20).fill(spec.filler)).map(id => add(owner, id))
    pl.discard = (side.discard ?? []).map(id => add(owner, id))
    const prizes = side.prizes ?? 6
    pl.prizes = (typeof prizes === 'number' ? Array<string>(prizes).fill(spec.filler) : prizes).map(id => add(owner, id))
  }
  if (spec.stadium) s.stadium = add(spec.turnPlayer ?? 0, spec.stadium)
  s.phase = 'main'
  s.turn = turn
  s.turnPlayer = spec.turnPlayer ?? 0
  s.firstPlayer = spec.firstPlayer ?? 0
  s.log.push({ turn, player: null, text: 'Scenario.' })
  return s
}
