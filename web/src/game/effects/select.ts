// Selectors and conditions card definitions are written with: filters over
// catalog cards, queries over Pokémon in play, and predicates over the game.

import type { CatalogCard, EnergyType, TrainerSubtype } from '../catalog/types'
import type { X } from '../engine/impl'
import { abilityOff } from '../engine/modifiers'
import { benchLimit, cardOf, energyAlternatives, inPlay, lastTurnOf, other, topCard, PRIZES } from '../engine/rules'
import type { Ctx, PlayerId, Slot } from '../engine/types'

// ── card filters ─────────────────────────────────────────────────────────

export type CardFilter = (c: CatalogCard) => boolean

export const any: CardFilter = () => true
export const pokemon: CardFilter = c => c.kind === 'pokemon'
export const basicPokemon: CardFilter = c => c.kind === 'pokemon' && c.subtype === 'Basic'
export const evolutionPokemon: CardFilter = c => c.kind === 'pokemon' && c.subtype !== 'Basic'
export const stage = (s: 'Basic' | 'Stage 1' | 'Stage 2'): CardFilter => c => c.kind === 'pokemon' && c.subtype === s
export const ruleBox: CardFilter = c => c.kind === 'pokemon' && c.tags.includes('ex')
export const noRuleBox: CardFilter = c => c.kind === 'pokemon' && !c.tags.includes('ex')
export const ex: CardFilter = c => c.kind === 'pokemon' && c.tags.includes('ex')
export const mega: CardFilter = c => c.tags.includes('Mega')
export const tera: CardFilter = c => c.tags.includes('Tera')
export const tagged = (tag: string): CardFilter => c => c.tags.includes(tag)
export const ofType = (t: EnergyType): CardFilter => c => c.kind === 'pokemon' && (c.types ?? []).includes(t)
export const named = (name: string): CardFilter => c => c.name === name
export const nameHas = (part: string): CardFilter => c => c.name.includes(part)
export const hpAtMost = (n: number): CardFilter => c => (c.hp ?? 0) <= n
export const hasAbility: CardFilter = c => (c.abilities ?? []).length > 0
export const noAbilities: CardFilter = c => (c.abilities ?? []).length === 0
export const energyCard: CardFilter = c => c.kind === 'energy'
export const basicEnergy = (t?: EnergyType): CardFilter => c => c.kind === 'energy' && c.subtype === 'Basic' && (!t || c.energyType === t)
export const specialEnergy: CardFilter = c => c.kind === 'energy' && c.subtype === 'Special'
export const trainer: CardFilter = c => c.kind === 'trainer'
export const trainerOf = (t: TrainerSubtype): CardFilter => c => c.kind === 'trainer' && c.subtype === t
export const aceSpec: CardFilter = c => c.tags.includes('ACE SPEC')

export const and = (...fs: CardFilter[]): CardFilter => c => fs.every(f => f(c))
export const or = (...fs: CardFilter[]): CardFilter => c => fs.some(f => f(c))
export const not = (f: CardFilter): CardFilter => c => !f(c)

/** The uids in a list whose cards pass the filter. */
export function matching(ctx: Ctx, uids: number[], f: CardFilter): number[] {
  return uids.filter(uid => f(cardOf(ctx, uid)))
}

// ── Pokémon in play ──────────────────────────────────────────────────────

export const card = (ctx: Ctx, slot: Slot) => topCard(ctx, slot)
export const is = (ctx: Ctx, slot: Slot, f: CardFilter) => f(topCard(ctx, slot))

export function active(ctx: Ctx, p: PlayerId): Slot | null {
  return ctx.s.players[p].active
}

export function bench(ctx: Ctx, p: PlayerId, f: CardFilter = any): Slot[] {
  return ctx.s.players[p].bench.filter(b => f(topCard(ctx, b)))
}

export function inPlayOf(ctx: Ctx, p: PlayerId, f: CardFilter = any): Slot[] {
  return inPlay(ctx.s.players[p]).filter(b => f(topCard(ctx, b)))
}

export function bothInPlay(ctx: Ctx, f: CardFilter = any): Slot[] {
  return [...inPlayOf(ctx, 0, f), ...inPlayOf(ctx, 1, f)]
}

/** How many Pokémon this player's Bench can hold. */
export function benchRoom(ctx: Ctx, p: PlayerId): number {
  return benchLimit(ctx, p)
}

export function isActive(ctx: Ctx, slot: Slot): boolean {
  return ctx.s.players.some(pl => pl.active?.id === slot.id)
}

export function ownerOfSlot(ctx: Ctx, slot: Slot): PlayerId {
  return ctx.s.cards[slot.id].owner
}

/** Energy attached, optionally only cards that can provide this type. */
export function energyOn(ctx: Ctx, slot: Slot, t?: EnergyType): number[] {
  if (!t) return [...slot.energy]
  return slot.energy.filter(uid => energyAlternatives(ctx, slot, uid).some(a => a.includes(t) || a.includes('Any')))
}

/** Total Energy units attached (a card providing 2 counts 2). */
export function energyCount(ctx: Ctx, slot: Slot, t?: EnergyType): number {
  let n = 0
  for (const uid of energyOn(ctx, slot, t)) {
    const alts = energyAlternatives(ctx, slot, uid)
    n += Math.max(...alts.map(a => (t ? a.filter(u => u === t || u === 'Any').length : a.length)))
  }
  return n
}

export const counters = (slot: Slot) => slot.damage / 10
export const damaged = (slot: Slot) => slot.damage > 0

/** Does this Pokémon have an Ability that is currently working? */
export function hasWorkingAbility(ctx: Ctx, slot: Slot): boolean {
  return (topCard(ctx, slot).abilities ?? []).some(a => !abilityOff(ctx, slot, a.name))
}

// ── game predicates ──────────────────────────────────────────────────────

export const prizesLeft = (ctx: Ctx, p: PlayerId) => ctx.s.players[p].prizes.length
/** Prize cards this player has taken. */
export const prizesTaken = (ctx: Ctx, p: PlayerId) => PRIZES - ctx.s.players[p].prizes.length
export const handSize = (ctx: Ctx, p: PlayerId) => ctx.s.players[p].hand.length
export const stadiumIs = (ctx: Ctx, name: string) => ctx.s.stadium !== null && cardOf(ctx, ctx.s.stadium).name === name

/** Were any of this player's Pokémon Knocked Out during the opponent's last turn? */
export function knockedOutLastTurn(ctx: Ctx, p: PlayerId, opts: { byAttack?: boolean; filter?: CardFilter } = {}): boolean {
  const last = lastTurnOf(ctx, other(p))
  return !!last?.knockOuts.some(k =>
    k.owner === p && (!opts.byAttack || k.byAttack) && (!opts.filter || opts.filter(ctx.db.card(k.cardId))))
}

/** Did this player go first? */
export const wentFirst = (ctx: Ctx, p: PlayerId) => ctx.s.firstPlayer === p

/** Convenience for card files: the opponent's Active, or null. */
export const oppActive = (x: X) => x.s.players[x.opp].active
export const myActive = (x: X) => x.s.players[x.me].active
