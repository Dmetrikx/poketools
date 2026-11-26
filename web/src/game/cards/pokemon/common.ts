// Timed effects and helpers shared by Pokémon attacks and abilities.

import type { CardFilter } from '../../effects/select'
import {
  addMarker, attachEnergy, cardOf, chooseCards, chooseOption, choosePokemon, damageActive, defineMarker,
  lastTurnOf, log, matching, nameOf, reaches, sel, shuffleInPlace, thisTurn, useAttackOf,
  type AttackX, type Proc, type Slot, type X,
} from '../fx'

const { ownerOfSlot, is } = sel

// ── markers ──────────────────────────────────────────────────────────────

/** "During your next turn, this Pokémon can't attack." */
export const CANT_ATTACK = defineMarker('cantAttack', { modifiers: {
  canAttack: (src, _c, slot) => src.marker!.slot !== slot.id,
} })

/** "…can't use [attack]" (this Pokémon next turn, or the Defending Pokémon — Torment). */
export const CANT_USE = defineMarker('cantUseAttack', { modifiers: {
  canAttack: (src, _c, slot, attack) => !(src.marker!.slot === slot.id && attack.name === src.marker!.data!.attack),
} })

/** "During your opponent's next turn, the Defending Pokémon can't retreat." */
export const CANT_RETREAT = defineMarker('cantRetreat', { modifiers: {
  canRetreat: (src, _c, slot) => src.marker!.slot !== slot.id,
} })

/** "During your opponent's next turn, they can't play any Item cards from their hand." */
export const NO_ITEMS = defineMarker('noItems', { modifiers: {
  canPlay: (src, ctx, p, uid) => !(p !== src.player && cardOf(ctx, uid).kind === 'trainer' && cardOf(ctx, uid).subtype === 'Item'),
} })

/** "This Pokémon takes n less damage from attacks (after Weakness and Resistance)." */
export const TAKES_LESS = defineMarker('takesLess', { modifiers: {
  damageTaken: (src, ctx, ev) => (ev.target.id === src.marker!.slot && ownerOfSlot(ctx, ev.attacker) !== src.player ? Number(src.marker!.data!.amount) : 0),
} })

/** "Attacks used by the Defending Pokémon do n less damage (before Weakness and Resistance)." */
export const DEALS_LESS = defineMarker('dealsLess', { modifiers: {
  damageDealt: (src, _c, ev) => (ev.attacker.id === src.marker!.slot ? -Number(src.marker!.data!.amount) : 0),
} })

/** "Prevent all damage from and effects of attacks done to this Pokémon" (data.effects false: damage only). */
export const SHIELDED = defineMarker('shielded', { modifiers: {
  preventDamage: (src, ctx, ev) => ev.target.id === src.marker!.slot && ownerOfSlot(ctx, ev.attacker) !== src.player,
  preventEffect: (src, _c, r) => r.target.id === src.marker!.slot && r.from === 'attack' && r.by !== src.player && src.marker!.data?.effects !== false,
} })

/** Crown Opal: "prevent all damage done to this Pokémon by attacks from Basic non-{C} Pokémon." */
export const CROWN_OPAL = defineMarker('crownOpal', { modifiers: {
  preventDamage: (src, ctx, ev) => ev.target.id === src.marker!.slot && ownerOfSlot(ctx, ev.attacker) !== src.player &&
    is(ctx, ev.attacker, sel.basicPokemon) && !is(ctx, ev.attacker, sel.ofType('Colorless')),
} })

/** "If your opponent's Pokémon is Knocked Out by damage from this attack, take 1 more Prize card." */
export const EXTRA_PRIZE = defineMarker('extraPrize', { modifiers: {
  prizes: (src, _c, ko) => (ko.byAttack && ko.owner !== src.player && ko.attacker?.id === src.marker!.slot ? 1 : 0),
} })

export const cantAttackNextTurn = (a: AttackX) => addMarker(a, CANT_ATTACK, { until: 'myNextTurn', slot: a.attacker })
export const cantUseNextTurn = (a: AttackX) => addMarker(a, CANT_USE, { until: 'myNextTurn', slot: a.attacker, data: { attack: a.attack.name } })

export function defenderCantRetreat(a: AttackX): void {
  if (a.defender && reachesDefender(a)) addMarker(a, CANT_RETREAT, { until: 'opponentsNextTurn', slot: a.defender })
}

export function defenderDealsLess(a: AttackX, amount: number): void {
  if (a.defender && reachesDefender(a)) addMarker(a, DEALS_LESS, { until: 'opponentsNextTurn', slot: a.defender, data: { amount } })
}

export const takesLessNextTurn = (a: AttackX, amount: number) => addMarker(a, TAKES_LESS, { until: 'opponentsNextTurn', slot: a.attacker, data: { amount } })

function reachesDefender(a: AttackX): boolean {
  return !!a.defender && reaches(a, a.defender)
}

// ── attack helpers ───────────────────────────────────────────────────────

/** Printed damage to the Defending Pokémon plus a bonus. */
export const hitPlus = (a: AttackX, bonus: number, opts?: Parameters<typeof damageActive>[2]) => damageActive(a, a.base + bonus, opts)

/** Printed damage per unit ("50×"). */
export const hitTimes = (a: AttackX, n: number, opts?: Parameters<typeof damageActive>[2]) => damageActive(a, a.base * n, opts)

/** Pokémon in a discard pile that have an ability by this name. */
export function discardWithAbility(x: X, p: X['me'], ability: string): number {
  return x.s.players[p].discard.filter(u => (cardOf(x, u).abilities ?? []).some(ab => ab.name === ability)).length
}

/** Has an activated ability group been used this turn (Run Errand, "Last-Ditch", …)? Records the use. */
export function claimGroup(x: X, group: string): boolean {
  const uses = thisTurn(x).abilities
  if (uses.some(u => u.group === group)) return false
  uses.push({ slot: x.self?.id ?? x.card ?? -1, name: group, group })
  return true
}

export const groupFree = (x: X, group: string) => !thisTurn(x).abilities.some(u => u.group === group)

/** Did one of your Pokémon use this attack during your last turn? */
export function usedLastTurn(x: X, attack: string): boolean {
  return !!lastTurnOf(x, x.me)?.attacks.some(a => a.name === attack)
}

/**
 * Choose 1 of a card's attacks and use it as this attack. The copying
 * attack itself is never an option (copying Night Joker with Night Joker
 * would only loop).
 */
export function* copyFrom(a: AttackX, cardId: string, title: string): Proc {
  const attacks = (a.db.card(cardId).attacks ?? []).filter(at => at.name !== a.attack.name)
  if (!attacks.length) return
  const i = yield* chooseOption(a, title, attacks.map(at => at.name))
  yield* useAttackOf(a, cardId, attacks[i])
}

/** Copy: choose a Pokémon among `slots`, then 1 of its attacks. */
export function* copyFromSlots(a: AttackX, slots: Slot[], title: string): Proc {
  const options = slots.flatMap(s => (sel.card(a, s).attacks ?? [])
    .filter(at => at.name !== a.attack.name)
    .map(at => ({ cardId: sel.card(a, s).id, at, label: `${sel.card(a, s).name}: ${at.name}` })))
  if (!options.length) return
  const i = yield* chooseOption(a, title, options.map(o => o.label))
  yield* useAttackOf(a, options[i].cardId, options[i].at)
}

/** Look at the top n cards, attach any Basic Energy passing the filter, rest shuffled to the bottom. */
export function* attachFromTop(x: X, n: number, filter: CardFilter, max: number, targets: () => Slot[], title: string): Proc<number> {
  const looked = x.s.players[x.me].deck.slice(0, n)
  const picks = yield* chooseCards(x, { title, options: matching(x, looked, filter), min: 0, max })
  for (const uid of picks) {
    const [slot] = yield* choosePokemon(x, { title: `Attach ${nameOf(x, uid)} to…`, options: targets() })
    if (slot) yield* attachEnergy(x, uid, slot)
  }
  const rest = looked.filter(u => !picks.includes(u))
  shuffleRestToBottom(x, rest)
  return picks.length
}

/** "Shuffle the other cards and put them on the bottom of your deck." */
export function shuffleRestToBottom(x: X, rest: number[]): void {
  const pl = x.s.players[x.me]
  pl.deck = pl.deck.filter(u => !rest.includes(u))
  const order = [...rest]
  shuffleInPlace(x.s, order)
  pl.deck.push(...order)
  if (rest.length) log(x, x.me, `Puts ${rest.length} card${rest.length === 1 ? '' : 's'} on the bottom of their deck.`)
}

