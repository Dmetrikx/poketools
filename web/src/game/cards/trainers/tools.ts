// Pokémon Tools in the card pool, each written from its catalog text.

import {
  attachEnergy, chooseCards, choosePokemon, defineCard, draw, log, matching, may, moveEnergy, placeCounters,
  sel, type Source,
} from '../fx'

import type { EnergyType } from '../../catalog/types'
import { canPay } from '../../engine/rules'

const { isActive, is, ownerOfSlot } = sel
const on = (src: Source, slotId: number) => src.slot?.id === slotId

// Air Balloon: The Retreat Cost of the Pokémon this card is attached to is {C}{C} less.
defineCard('ASC-181', { trainer: { modifiers: { retreatCost: (src, _c, slot) => (on(src, slot.id) ? -2 : 0) } } })

// Binding Mochi: Attacks used by the Poisoned Pokémon this card is attached to do 40 more damage to
// your opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('PRE-95', { trainer: { modifiers: {
  damageDealt: (src, _c, ev) => (ev.toActive && on(src, ev.attacker.id) && ev.attacker.poisoned ? 40 : 0),
} } })

// Brave Bangle: If the Pokémon this card is attached to doesn't have a Rule Box, the attacks it uses
// do 30 more damage to your opponent's Active Pokémon ex (before applying Weakness and Resistance).
defineCard('WHT-80', { trainer: { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && on(src, ev.attacker.id) && is(ctx, ev.attacker, sel.noRuleBox) && is(ctx, ev.target, sel.ex) ? 30 : 0),
} } })

// Cynthia's Power Weight: The Cynthia's Pokémon this card is attached to gets +70 HP.
defineCard('DRI-162', { trainer: { modifiers: { hp: (src, ctx, slot) => (on(src, slot.id) && is(ctx, slot, sel.tagged("Cynthia's")) ? 70 : 0) } } })

// Gravity Gemstone: As long as the Pokémon this card is attached to is in the Active Spot, the
// Retreat Cost of both Active Pokémon is {C} more.
defineCard('SCR-137', { trainer: { modifiers: {
  retreatCost: (src, ctx, slot) => (src.slot && isActive(ctx, src.slot) && isActive(ctx, slot) ? 1 : 0),
} } })

// Handheld Fan: If the Pokémon this card is attached to is in the Active Spot and is damaged by an
// attack from your opponent's Pokémon (even if it is Knocked Out), move an Energy from the Attacking
// Pokémon to 1 of your opponent's Benched Pokémon.
defineCard('TWM-150', { trainer: { on: { *damagedByAttack(x, ev) {
  if (!x.self || ev.target.id !== x.self.id || !isActive(x, x.self) || ownerOfSlot(x, ev.attacker) === x.me) return
  const bench = sel.bench(x, x.opp)
  if (!ev.attacker.energy.length || !bench.length) return
  const [uid] = yield* chooseCards(x, { title: 'Handheld Fan: move an Energy from the Attacking Pokémon', options: ev.attacker.energy })
  const [to] = yield* choosePokemon(x, { title: 'To 1 of your opponent\'s Benched Pokémon', options: bench })
  if (uid !== undefined && to) moveEnergy(x, uid, to)
} } } })

// Hero's Cape: The Pokémon this card is attached to gets +100 HP.
defineCard('TEF-152', { trainer: { modifiers: { hp: (src, _c, slot) => (on(src, slot.id) ? 100 : 0) } } })

// Lillie's Pearl: If the Lillie's Pokémon this card is attached to is Knocked Out by damage from an
// attack from your opponent's Pokémon, that player takes 1 fewer Prize card.
defineCard('JTG-151', { trainer: { modifiers: {
  prizes: (src, ctx, ko) => (on(src, ko.slot.id) && ko.byAttack && ko.attackerOwner !== src.player && is(ctx, ko.slot, sel.tagged("Lillie's")) ? -1 : 0),
} } })

// Lucky Helmet: If the Pokémon this card is attached to is in the Active Spot and is damaged by an
// attack from your opponent's Pokémon (even if it is Knocked Out), draw 2 cards.
defineCard('TWM-158', { trainer: { on: { damagedByAttack(x, ev) {
  if (x.self && ev.target.id === x.self.id && isActive(x, x.self) && ownerOfSlot(x, ev.attacker) !== x.me) draw(x, 2)
} } } })

// Powerglass: At the end of your turn (after your attack), if the Pokémon this card is attached to
// is in the Active Spot, you may attach a Basic Energy card from your discard pile to it.
defineCard('SFA-63', { trainer: { on: { *turnEnd(x, ev) {
  if (ev.player !== x.me || !x.self || !isActive(x, x.self)) return
  const options = matching(x, x.s.players[x.me].discard, sel.basicEnergy())
  if (!options.length || !(yield* may(x, 'Powerglass: attach a Basic Energy from your discard pile?'))) return
  const [uid] = yield* chooseCards(x, { title: 'Choose a Basic Energy', options })
  if (uid !== undefined) yield* attachEnergy(x, uid, x.self)
} } } })

// Punk Helmet: If the {D} Pokémon this card is attached to is in the Active Spot and is damaged by an
// attack from your opponent's Pokémon (even if it is Knocked Out), place 4 damage counters on the Attacking Pokémon.
defineCard('PFL-92', { trainer: { on: { damagedByAttack(x, ev) {
  if (x.self && ev.target.id === x.self.id && isActive(x, x.self) && ownerOfSlot(x, ev.attacker) !== x.me && is(x, x.self, sel.ofType('Darkness'))) {
    placeCounters(x, ev.attacker, 4)
  }
} } } })

// Survival Brace: If the Pokémon this card is attached to has full HP and would be Knocked Out by
// damage from an attack from your opponent's Pokémon, it is not Knocked Out, and its remaining HP
// becomes 10. Then, discard this card.
defineCard('TWM-164', { trainer: { modifiers: {
  survive: (src, ctx, ev, before) => {
    if (!src.slot || !on(src, ev.target.id) || before !== 0 || ownerOfSlot(ctx, ev.attacker) === src.player) return false
    const i = src.slot.tools.indexOf(src.uid!)
    if (i >= 0) {
      src.slot.tools.splice(i, 1)
      ctx.s.players[src.player].discard.push(src.uid!)
      log(ctx, src.player, 'Survival Brace is discarded.')
    }
    return true
  },
} } })

// ── Standard events after LAIC (5+ lists) ────────────────────────────────

/** An attack cost with one symbol removed: the first of `prefer`, else any. */
function withoutOne(cost: EnergyType[], prefer: (t: EnergyType) => boolean, anyType: boolean): EnergyType[] {
  let i = cost.findIndex(prefer)
  if (i < 0 && anyType) i = cost.length - 1
  return i < 0 ? cost : [...cost.slice(0, i), ...cost.slice(i + 1)]
}

// Hop's Choice Band: Attacks used by the Hop's Pokémon this card is attached to cost {C} less and do
// 30 more damage to your opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('JTG-148', { trainer: { modifiers: {
  attackCost: (src, ctx, slot, _attack, cost) => (on(src, slot.id) && is(ctx, slot, sel.tagged("Hop's")) ? withoutOne(cost, t => t === 'Colorless', false) : cost),
  damageDealt: (src, ctx, ev) => (ev.toActive && on(src, ev.attacker.id) && is(ctx, ev.attacker, sel.tagged("Hop's")) ? 30 : 0),
} } })

// Maximum Belt: Attacks used by the Pokémon this card is attached to do 50 more damage to your
// opponent's Active Pokémon ex (before applying Weakness and Resistance).
defineCard('TEF-154', { trainer: { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && on(src, ev.attacker.id) && is(ctx, ev.target, sel.ex) ? 50 : 0),
} } })

// Sparkling Crystal: When the Tera Pokémon this card is attached to uses an attack, that attack costs
// 1 Energy less. (The Energy can be of any type.) The symbol dropped is one whose removal lets the
// attached Energy pay, else a typed one: the player picks the type, so the cost is the cheapest.
defineCard('SCR-142', { trainer: { modifiers: {
  attackCost: (src, ctx, slot, _attack, cost) => {
    if (!on(src, slot.id) || !is(ctx, slot, sel.tera) || !cost.length) return cost
    const options = [...new Set(cost)].map(t => withoutOne(cost, x => x === t, false))
    return options.find(c => canPay(ctx, slot, c)) ?? withoutOne(cost, t => t !== 'Colorless', true)
  },
} } })
