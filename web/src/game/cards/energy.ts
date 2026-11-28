// Special Energy in the card pool, each written from its catalog text.

import {
  addMarker, attachEnergy, defineCard, defineMarker, draw, log, placeCounters, searchToBench, sel, useOnce,
  type EnergyUnit, type Source,
} from './fx'

const { is, isActive, ownerOfSlot } = sel
const on = (src: Source, slotId: number) => src.slot?.id === slotId

// Boomerang Energy: provides {C}. If this card is discarded by an effect of an attack used by the
// Pokémon this card is attached to, attach this card from your discard pile to that Pokémon after attacking.
const boomerang = defineMarker('boomerangReturn', { on: { *attackDone(x, ev) {
  const m = x.s.markers.find(mk => mk.kind === 'boomerangReturn' && mk.player === x.me && mk.data?.slot === ev.attacker.id)
  if (!m) return
  x.s.markers = x.s.markers.filter(mk => mk.id !== m.id)
  const uid = m.data!.uid as number
  if (x.s.players[x.me].discard.includes(uid) && sel.inPlayOf(x, x.me).some(s => s.id === ev.attacker.id)) {
    yield* attachEnergy(x, uid, ev.attacker)
  }
} } })
defineCard('TWM-166', { energy: { on: { discardedByAttack(x, ev) {
  if (x.card !== null && x.self && ev.cards.includes(x.card) && ev.attacker.id === x.self.id) {
    addMarker(x, boomerang, { until: 'thisTurn', data: { uid: x.card, slot: x.self.id } })
  }
} } } })

// Bubbly Water Energy: provides {W}. The {W} Pokémon this card is attached to recovers from all
// Special Conditions and can't be affected by any Special Conditions.
defineCard('CRI-84', { energy: {
  provides: () => [['Water']],
  modifiers: { canHaveCondition: (src, ctx, slot) => !(on(src, slot.id) && is(ctx, slot, sel.ofType('Water'))) },
} })

// Enriching Energy: provides {C}. When you attach this card from your hand to a Pokémon, draw 4 cards.
defineCard('SSP-191', { energy: { on: { attached(x, ev) {
  if (ev.card === x.card && ev.fromHand) draw(x, 4)
} } } })

// Growing Grass Energy: provides {G}. The {G} Pokémon this card is attached to gets +20 HP.
defineCard('POR-86', { energy: {
  provides: () => [['Grass']],
  modifiers: { hp: (src, ctx, slot) => (on(src, slot.id) && is(ctx, slot, sel.ofType('Grass')) ? 20 : 0) },
} })

// Ignition Energy: If this card is attached to 1 of your Pokémon, discard it at the end of your turn.
// Provides {C}; if attached to an Evolution Pokémon, provides {C}{C}{C} instead.
defineCard('WHT-86', { energy: {
  provides: (ctx, slot) => (is(ctx, slot, sel.evolutionPokemon) ? [['Colorless', 'Colorless', 'Colorless']] : [['Colorless']]),
  on: { turnEnd(x, ev) {
    if (ev.player !== x.me || !x.self || x.card === null) return
    const i = x.self.energy.indexOf(x.card)
    if (i < 0) return
    x.self.energy.splice(i, 1)
    x.s.players[x.me].discard.push(x.card)
    log(x, x.me, 'Ignition Energy is discarded.')
  } },
} })

// Legacy Energy: provides every type but only 1 at a time. If the Pokémon this card is attached to
// is Knocked Out by damage from an attack from your opponent's Pokémon, that player takes 1 fewer
// Prize card. This effect can't be applied more than once per game.
defineCard('TWM-167', { energy: {
  provides: () => [['Any']],
  modifiers: { prizes: (src, ctx, ko) => (on(src, ko.slot.id) && ko.byAttack && ko.attackerOwner !== src.player && useOnce(ctx, `legacy:${src.player}`) ? -1 : 0) },
} })

// Mist Energy: provides {C}. Prevent all effects of attacks used by your opponent's Pokémon done to
// the Pokémon this card is attached to. (Damage is not an effect.)
defineCard('TEF-161', { energy: { modifiers: {
  preventEffect: (src, _c, r) => on(src, r.target.id) && r.from === 'attack' && r.by !== src.player,
} } })

// Neo Upper Energy: provides {C}. If attached to a Stage 2 Pokémon, provides every type but only 2 at a time.
defineCard('TEF-162', { energy: {
  provides: (ctx, slot): EnergyUnit[][] => (is(ctx, slot, sel.stage('Stage 2')) ? [['Any', 'Any']] : [['Colorless']]),
} })

// Prism Energy: provides {C}. If attached to a Basic Pokémon, provides every type but only 1 at a time.
defineCard('ASC-216', { energy: {
  provides: (ctx, slot): EnergyUnit[][] => (is(ctx, slot, sel.basicPokemon) ? [['Any']] : [['Colorless']]),
} })

// Rocky Fighting Energy: provides {F}. Prevent all effects of attacks used by your opponent's Pokémon
// done to the {F} Pokémon this card is attached to.
defineCard('POR-87', { energy: {
  provides: () => [['Fighting']],
  modifiers: { preventEffect: (src, ctx, r) => on(src, r.target.id) && r.from === 'attack' && r.by !== src.player && is(ctx, r.target, sel.ofType('Fighting')) },
} })

// Spiky Energy: provides {C}. If the Pokémon this card is attached to is in the Active Spot and is
// damaged by an attack from your opponent's Pokémon (even if it is Knocked Out), put 2 damage
// counters on the Attacking Pokémon.
defineCard('JTG-159', { energy: { on: { damagedByAttack(x, ev) {
  if (x.self && ev.target.id === x.self.id && isActive(x, x.self) && ownerOfSlot(x, ev.attacker) !== x.me) placeCounters(x, ev.attacker, 2)
} } } })

// Team Rocket's Energy: can only be attached to a Team Rocket's Pokémon; otherwise discard it.
// Provides 2 in any combination of {P} and {D} Energy.
defineCard('DRI-182', { energy: {
  canAttach: (x, slot) => is(x, slot, sel.tagged("Team Rocket's")),
  provides: () => [['Psychic', 'Psychic'], ['Psychic', 'Darkness'], ['Darkness', 'Darkness']],
} })

// Telepathic Psychic Energy: provides {P}. When you attach this card from your hand to a {P}
// Pokémon, search your deck for up to 2 Basic {P} Pokémon and put them onto your Bench. Then, shuffle.
defineCard('POR-88', { energy: {
  provides: () => [['Psychic']],
  on: { *attached(x, ev) {
    if (ev.card !== x.card || !ev.fromHand || !is(x, ev.slot, sel.ofType('Psychic'))) return
    yield* searchToBench(x, { filter: sel.and(sel.basicPokemon, sel.ofType('Psychic')), max: 2, title: 'Choose up to 2 Basic {P} Pokémon' })
  } },
} })
