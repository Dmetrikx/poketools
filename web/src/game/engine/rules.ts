import type { CatalogAttack, CatalogCard, EnergyType } from '../catalog/types'
import type { WeaknessResistance } from '../catalog/types'
import { allowed, each, implOf } from './modifiers'
import { shuffleInPlace } from './rng'
import type { Ctx, PlayerId, PlayerState, Slot, TurnRecord } from './types'

// Queries and small state changes shared by every procedure. The effect
// package (milestone 4) hooks its modifiers into the queries here, so the
// rest of the engine never reads raw printed values directly.

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0)

export const MAX_BENCH = 5
export const PRIZES = 6
export const HAND_SIZE = 7

// ── card lookup ──────────────────────────────────────────────────────────

export function cardOf(ctx: Ctx, uid: number): CatalogCard {
  return ctx.db.card(ctx.s.cards[uid].cardId)
}

export function ownerOf(ctx: Ctx, uid: number): PlayerId {
  return ctx.s.cards[uid].owner
}

export function nameOf(ctx: Ctx, uid: number): string {
  return cardOf(ctx, uid).name
}

export function topCard(ctx: Ctx, slot: Slot): CatalogCard {
  return cardOf(ctx, slot.stack[slot.stack.length - 1])
}

export function slotName(ctx: Ctx, slot: Slot): string {
  return topCard(ctx, slot).name
}

export const isPokemon = (c: CatalogCard) => c.kind === 'pokemon'
export const isBasicPokemon = (c: CatalogCard) => c.kind === 'pokemon' && c.subtype === 'Basic'
export const isEvolution = (c: CatalogCard) => c.kind === 'pokemon' && c.subtype !== 'Basic'
export const isEnergy = (c: CatalogCard) => c.kind === 'energy'
export const isBasicEnergy = (c: CatalogCard) => c.kind === 'energy' && c.subtype === 'Basic'
export const isTrainer = (c: CatalogCard) => c.kind === 'trainer'
export const hasRuleBox = (c: CatalogCard) => c.tags.includes('ex')

// ── players and slots ────────────────────────────────────────────────────

export function inPlay(pl: PlayerState): Slot[] {
  return pl.active ? [pl.active, ...pl.bench] : [...pl.bench]
}

export function allSlots(ctx: Ctx): Slot[] {
  return [...inPlay(ctx.s.players[0]), ...inPlay(ctx.s.players[1])]
}

export function findSlot(ctx: Ctx, id: number): { slot: Slot; player: PlayerId; active: boolean } | null {
  for (const p of [0, 1] as PlayerId[]) {
    const pl = ctx.s.players[p]
    if (pl.active?.id === id) return { slot: pl.active, player: p, active: true }
    const b = pl.bench.find(s => s.id === id)
    if (b) return { slot: b, player: p, active: false }
  }
  return null
}

export function slotOwner(ctx: Ctx, slot: Slot): PlayerId {
  return ownerOf(ctx, slot.id)
}

/** Every uid in the slot: stack, energy, tools. */
export function slotCards(slot: Slot): number[] {
  return [...slot.stack, ...slot.energy, ...slot.tools]
}

export function newSlot(uid: number, turn: number): Slot {
  return {
    id: uid, stack: [uid], energy: [], tools: [], damage: 0,
    rotation: null, poisoned: false, burned: false, enteredTurn: turn, evolvedTurn: -1,
  }
}

export function benchLimit(ctx: Ctx, p: PlayerId): number {
  let n = MAX_BENCH
  for (const [src, f] of each(ctx, 'benchSize')) n = Math.max(n, f(src, ctx, p) ?? 0)
  return n
}

/** Is it this player's first turn of the game? */
export function isFirstTurn(ctx: Ctx, p: PlayerId): boolean {
  return ctx.s.turn === (p === ctx.s.firstPlayer ? 1 : 2)
}

// ── stats ────────────────────────────────────────────────────────────────

export function maxHp(ctx: Ctx, slot: Slot): number {
  let hp = topCard(ctx, slot).hp ?? 0
  for (const [src, f] of each(ctx, 'hp')) hp += f(src, ctx, slot)
  return Math.max(0, hp)
}

export function remainingHp(ctx: Ctx, slot: Slot): number {
  return Math.max(0, maxHp(ctx, slot) - slot.damage)
}

export function retreatCost(ctx: Ctx, slot: Slot): number {
  let cost = topCard(ctx, slot).retreat ?? 0
  let none = false
  for (const [src, f] of each(ctx, 'retreatCost')) {
    const r = f(src, ctx, slot)
    if (r === 'none') none = true
    else cost += r
  }
  return none ? 0 : Math.max(0, cost)
}

export function attacksOf(ctx: Ctx, slot: Slot): CatalogAttack[] {
  return topCard(ctx, slot).attacks ?? []
}

/** The Pokémon's own attacks plus any it can borrow (Mew ex), with the card each is printed on. */
export function usableAttacks(ctx: Ctx, slot: Slot): { cardId: string; attack: CatalogAttack; own: boolean }[] {
  const top = topCard(ctx, slot)
  const out = attacksOf(ctx, slot).map(attack => ({ cardId: top.id, attack, own: true }))
  for (const [src, f] of each(ctx, 'extraAttacks')) {
    for (const e of f(src, ctx, slot)) {
      const attack = ctx.db.card(e.cardId).attacks?.find(a => a.name === e.attack)
      if (attack && !out.some(o => o.cardId === e.cardId && o.attack.name === attack.name)) out.push({ cardId: e.cardId, attack, own: false })
    }
  }
  return out
}

export function attackCost(ctx: Ctx, slot: Slot, attack: CatalogAttack): EnergyType[] {
  let cost = attack.cost
  for (const [src, f] of each(ctx, 'attackCost')) cost = f(src, ctx, slot, attack, cost)
  return cost
}

export function weaknessOf(ctx: Ctx, slot: Slot): WeaknessResistance | null {
  let w = topCard(ctx, slot).weakness ?? null
  for (const [src, f] of each(ctx, 'weakness')) w = f(src, ctx, slot, w)
  return w
}

/** Prize cards the opponent takes when this Pokémon is Knocked Out. */
export function prizeValue(ctx: Ctx, slot: Slot): number {
  const c = topCard(ctx, slot)
  if (c.tags.includes('Mega') && c.tags.includes('ex')) return 3
  if (c.tags.includes('ex')) return 2
  return 1
}

/** Printed number in a damage string: "200+" → 200, "50×" → 50, "" → 0. */
export function baseDamage(attack: CatalogAttack): number {
  const m = /^(\d+)/.exec(attack.damage)
  return m ? Number(m[1]) : 0
}

// ── energy ───────────────────────────────────────────────────────────────

export type EnergyUnit = EnergyType | 'Any'

/**
 * What one attached Energy card can provide: a list of alternatives, each a
 * list of units. Basic Energy provides its type. Special Energy provides
 * {C} until its definition says otherwise (milestone 6).
 */
export function energyAlternatives(ctx: Ctx, slot: Slot, uid: number): EnergyUnit[][] {
  const c = cardOf(ctx, uid)
  let alts: EnergyUnit[][]
  if (c.subtype === 'Basic' && c.energyType) alts = [[c.energyType]]
  else alts = implOf(ctx, uid)?.energy?.provides?.(ctx, slot, uid) ?? [['Colorless']]
  for (const [src, f] of each(ctx, 'energy')) alts = f(src, ctx, slot, uid, alts)
  return alts
}

/** Units an Energy card counts for when paying a Retreat Cost. */
export function energyAmount(ctx: Ctx, slot: Slot, uid: number): number {
  return Math.max(...energyAlternatives(ctx, slot, uid).map(a => a.length))
}

/** Can these units pay the cost? Exact types first, then wildcards, then {C}. */
export function unitsPay(units: EnergyUnit[], cost: EnergyType[]): boolean {
  const pool = new Map<EnergyUnit, number>()
  for (const u of units) pool.set(u, (pool.get(u) ?? 0) + 1)
  let colorless = 0
  for (const t of cost) {
    if (t === 'Colorless') { colorless++; continue }
    if (pool.get(t)) pool.set(t, pool.get(t)! - 1)
    else if (pool.get('Any')) pool.set('Any', pool.get('Any')! - 1)
    else return false
  }
  let left = 0
  for (const n of pool.values()) left += n
  return left >= colorless
}

/** Can the Energy attached to this Pokémon pay the cost, over every choice of alternatives? */
export function canPay(ctx: Ctx, slot: Slot, cost: EnergyType[]): boolean {
  if (cost.length === 0) return true
  const alts = slot.energy.map(uid => energyAlternatives(ctx, slot, uid))
  const pick = (i: number, units: EnergyUnit[]): boolean => {
    if (i === alts.length) return unitsPay(units, cost)
    return alts[i].some(a => pick(i + 1, [...units, ...a]))
  }
  return pick(0, [])
}

// ── state changes ────────────────────────────────────────────────────────

// ── turn history ─────────────────────────────────────────────────────────

const HISTORY = 4

export function newTurnRecord(turn: number, player: PlayerId): TurnRecord {
  return { turn, player, knockOuts: [], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false }
}

/** This turn's record. */
export function thisTurn(ctx: Ctx): TurnRecord {
  const h = ctx.s.history
  if (!h.length || h[h.length - 1].turn !== ctx.s.turn) {
    h.push(newTurnRecord(ctx.s.turn, ctx.s.turnPlayer))
    if (h.length > HISTORY) h.shift()
  }
  return h[h.length - 1]
}

/** The record of a turn `ago` turns back (1 = the previous turn), if kept. */
export function turnAgo(ctx: Ctx, ago: number): TurnRecord | undefined {
  return ctx.s.history.find(r => r.turn === ctx.s.turn - ago)
}

/** The given player's last turn before this one. */
export function lastTurnOf(ctx: Ctx, p: PlayerId): TurnRecord | undefined {
  return [...ctx.s.history].reverse().find(r => r.player === p && r.turn < ctx.s.turn)
}

// ── permissions ──────────────────────────────────────────────────────────

export const canHeal = (ctx: Ctx, slot: Slot) => allowed(ctx, 'canHeal', slot)
export const canRetreatNow = (ctx: Ctx, slot: Slot) => allowed(ctx, 'canRetreat', slot)
export const canMoveCounters = (ctx: Ctx) => allowed(ctx, 'canMoveCounters')
export const canPlayCard = (ctx: Ctx, p: PlayerId, uid: number) => allowed(ctx, 'canPlay', p, uid)

export function log(ctx: Ctx, player: PlayerId | null, text: string): void {
  ctx.s.log.push({ turn: ctx.s.turn, player, text })
}

/** Removes a uid from whichever player zone list holds it. */
export function takeFromZone(list: number[], uid: number): void {
  const i = list.indexOf(uid)
  if (i < 0) throw new Error(`card ${uid} not in zone`)
  list.splice(i, 1)
}

/** Draws up to n cards; returns how many were drawn. */
export function draw(ctx: Ctx, p: PlayerId, n: number): number {
  const pl = ctx.s.players[p]
  const k = Math.min(n, pl.deck.length)
  pl.hand.push(...pl.deck.splice(0, k))
  return k
}

export function shuffleDeck(ctx: Ctx, p: PlayerId): void {
  shuffleInPlace(ctx.s, ctx.s.players[p].deck)
}

export function clearConditions(slot: Slot): void {
  slot.rotation = null
  slot.poisoned = false
  slot.burned = false
}

/** Swaps the Active with a Benched Pokémon. The one moving to the Bench recovers from Special Conditions. */
export function switchActive(ctx: Ctx, p: PlayerId, benchId: number): void {
  const pl = ctx.s.players[p]
  const i = pl.bench.findIndex(s => s.id === benchId)
  if (i < 0 || !pl.active) throw new Error('switch: no such Benched Pokémon')
  const old = pl.active
  pl.active = pl.bench[i]
  clearConditions(old)
  pl.bench[i] = old
  leftActive(ctx, old)
  thisTurn(ctx).movedToActive.push(pl.active.id)
}

/** Effects on a Pokémon end when it moves to the Bench or evolves, unless sticky. */
export function leftActive(ctx: Ctx, slot: Slot): void {
  ctx.s.markers = ctx.s.markers.filter(m => m.slot !== slot.id || m.sticky)
}

/** Moves a Pokémon and everything attached to its owner's discard pile. */
export function discardSlot(ctx: Ctx, slot: Slot): void {
  const p = slotOwner(ctx, slot)
  const pl = ctx.s.players[p]
  ctx.s.markers = ctx.s.markers.filter(m => m.slot !== slot.id)
  if (pl.active?.id === slot.id) pl.active = null
  else pl.bench = pl.bench.filter(s => s.id !== slot.id)
  for (const uid of slotCards(slot)) pl.discard.push(uid)
}

export function discardFromSlot(ctx: Ctx, slot: Slot, uid: number): void {
  if (slot.energy.includes(uid)) takeFromZone(slot.energy, uid)
  else if (slot.tools.includes(uid)) takeFromZone(slot.tools, uid)
  else throw new Error(`card ${uid} not attached`)
  ctx.s.players[ownerOf(ctx, uid)].discard.push(uid)
}

/** Every uid in every zone, for conservation checks. */
export function allZoneCards(ctx: Ctx): number[] {
  const out: number[] = []
  for (const pl of ctx.s.players) {
    out.push(...pl.deck, ...pl.hand, ...pl.discard, ...pl.prizes)
    for (const slot of inPlay(pl)) out.push(...slotCards(slot))
  }
  if (ctx.s.stadium !== null) out.push(ctx.s.stadium)
  out.push(...ctx.s.resolving)
  return out
}
