// Team Rocket's Pokémon (Rocket's Honchkrow, Rocket's Mewtwo).

import {
  addMarker, attachEnergy, chooseCards, chooseOption, choosePokemon, damage, damageActive, defineCard,
  discardAttached, discardFromHand, matching, moveCounters, reaches, searchToHand, sel, selfDamage, type AttackX,
} from '../fx'
import { CANT_USE, copyFrom, hitPlus, hitTimes } from './common'

const { active, bench, inPlayOf, is, ownerOfSlot } = sel
const TR = sel.tagged("Team Rocket's")
const trSupporter = sel.and(sel.trainerOf('Supporter'), sel.nameHas('Team Rocket'))

// Team Rocket's Articuno — Repelling Veil: Prevent all effects of attacks used by your opponent's
// Pokémon done to your Basic Team Rocket's Pokémon. Dark Frost: If this Pokémon has any Team
// Rocket's Energy attached, this attack does 60 more damage.
defineCard('DRI-51', {
  abilities: { 'Repelling Veil': { modifiers: {
    preventEffect: (src, ctx, r) => r.from === 'attack' && r.by !== src.player && ownerOfSlot(ctx, r.target) === src.player &&
      is(ctx, r.target, sel.and(sel.basicPokemon, TR)),
  } } },
  attacks: { *'Dark Frost'(a) { hitPlus(a, matching(a, a.attacker.energy, sel.named("Team Rocket's Energy")).length ? 60 : 0) } },
})

// Team Rocket's Honchkrow — Rocket Feathers: You may discard any number of Supporter cards that have
// "Team Rocket" in their name from your hand, and this attack does 60 damage for each card discarded.
defineCard('ASC-127', { attacks: { *'Rocket Feathers'(a) {
  const n = (yield* discardFromHand(a, { filter: trSupporter, min: 0, max: 99, title: 'Discard any number of Team Rocket Supporters' })).length
  hitTimes(a, n)
} } })

// Team Rocket's Mewtwo ex — Power Saver: This Pokémon can't attack unless you have 4 or more Team
// Rocket's Pokémon in play. Erasure Ball: You may discard up to 2 Energy from your Benched Pokémon.
// This attack does 60 more damage for each card you discarded in this way.
defineCard('DRI-81', {
  abilities: { 'Power Saver': { modifiers: {
    canAttack: (src, ctx, slot) => src.slot?.id !== slot.id || inPlayOf(ctx, src.player, TR).length >= 4,
  } } },
  attacks: { *'Erasure Ball'(a) {
    const picks = yield* chooseCards(a, { title: 'Discard up to 2 Energy from your Benched Pokémon', options: bench(a, a.me).flatMap(s => s.energy), min: 0, max: 2 })
    yield* discardAttached(a, picks)
    hitPlus(a, 60 * picks.length)
  } },
})

// Team Rocket's Mimikyu — Gemstone Mimicry: Choose 1 of your opponent's Active Tera Pokémon's attacks
// and use it as this attack.
defineCard('DRI-87', { attacks: { *'Gemstone Mimicry'(a) {
  const opp = active(a, a.opp)
  if (opp && is(a, opp, sel.tera)) yield* copyFrom(a, sel.card(a, opp).id, 'Choose 1 of the opponent\'s Active Tera Pokémon\'s attacks')
} } })

// Team Rocket's Murkrow — Deceit: Search your deck for a Supporter card… Torment: Choose 1 of your
// opponent's Active Pokémon's attacks. During your opponent's next turn, that Pokémon can't use that attack.
defineCard('DRI-127', { attacks: {
  *Deceit(a) { yield* searchToHand(a, { filter: sel.trainerOf('Supporter'), title: 'Choose a Supporter' }) },
  *Torment(a) {
    damageActive(a, a.base)
    const opp = active(a, a.opp)
    if (!opp || !reaches(a, opp)) return
    const attacks = sel.card(a, opp).attacks ?? []
    if (!attacks.length) return
    const i = yield* chooseOption(a, 'Choose 1 of the Defending Pokémon\'s attacks to lock', attacks.map(at => at.name))
    addMarker(a, CANT_USE, { until: 'opponentsNextTurn', slot: opp, data: { attack: attacks[i].name } })
  },
} })

// Team Rocket's Porygon — Hacking: Discard a card from your hand. If you do, your opponent discards a
// card from their hand.
defineCard('DRI-153', { attacks: { *Hacking(a) {
  if (!(yield* discardFromHand(a, { min: 1, max: 1, title: 'Discard a card' })).length) return
  yield* discardFromHand(a, { player: a.opp, min: 1, max: 1, title: 'Discard a card' })
} } })

// Team Rocket's Porygon2 — R Command: This attack does 20 damage for each Supporter card that has
// "Team Rocket" in its name in your discard pile.
defineCard('DRI-154', { attacks: { *'R Command'(a) { hitTimes(a, matching(a, a.s.players[a.me].discard, trSupporter).length) } } })

// Team Rocket's Sneasel — Strike the Sleeper: This attack does 20 damage to 1 of your opponent's
// Benched Pokémon for each damage counter on that Pokémon.
defineCard('DRI-128', { attacks: { *'Strike the Sleeper'(a) {
  const [t] = yield* choosePokemon(a, { title: 'Choose 1 of your opponent\'s Benched Pokémon', options: bench(a, a.opp) })
  if (t) damage(a, t, 20 * (t.damage / 10))
} } })

// Team Rocket's Spidops — Charging Up: Once during your turn, you may attach a Basic Energy card from
// your discard pile to this Pokémon. Rocket Rush: 30 damage for each of your Team Rocket's Pokémon in play.
defineCard('DRI-20', {
  abilities: { 'Charging Up': {
    canUse: x => matching(x, x.s.players[x.me].discard, sel.basicEnergy()).length > 0,
    *use(x) {
      const [uid] = yield* chooseCards(x, { title: 'Attach a Basic Energy from your discard pile', options: matching(x, x.s.players[x.me].discard, sel.basicEnergy()) })
      if (uid !== undefined && x.self) yield* attachEnergy(x, uid, x.self)
    },
  } },
  attacks: { *'Rocket Rush'(a) { hitTimes(a, inPlayOf(a, a.me, TR).length) } },
})

// Team Rocket's Tarountula — Take Down: This Pokémon also does 10 damage to itself.
defineCard('DRI-19', { attacks: { *'Take Down'(a: AttackX) { damageActive(a, a.base); selfDamage(a, 10) } } })

// Team Rocket's Wobbuffet — Rocket Mirror: Move all damage counters from 1 of your Benched Team
// Rocket's Pokémon to your opponent's Active Pokémon.
defineCard('DRI-82', { attacks: { *'Rocket Mirror'(a) {
  const [from] = yield* choosePokemon(a, { title: "Choose 1 of your Benched Team Rocket's Pokémon", options: bench(a, a.me, TR).filter(s => s.damage > 0) })
  const to = active(a, a.opp)
  if (from && to) moveCounters(a, from, to, from.damage / 10)
} } })
