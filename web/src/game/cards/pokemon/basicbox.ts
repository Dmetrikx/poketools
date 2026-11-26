// Basic Box: Koraidon ex, Talonflame ex, Lillie's Clefairy ex, Mega Kangaskhan ex, Passimian,
// Chien-Pao, Latias ex, Raging Bolt ex, Teal Mask / Wellspring Mask Ogerpon ex.

import {
  attachEnergy, chooseCards, choosePokemon, damage, damageActive, defineCard, discardAttached, discardHand,
  discardStadium, draw, flipUntilTails, matching, may, moveCards, putOntoBench, searchDeck, sel, shuffleDeck,
} from '../fx'
import { cantAttackNextTurn, cantUseNextTurn, defenderCantRetreat, hitPlus, hitTimes } from './common'

const { active, bench, energyCount, inPlayOf, is, isActive } = sel

// Koraidon ex — Orichalcum Fang: If any of your Pokémon were Knocked Out by damage from an attack
// during your opponent's last turn, this attack does 120 more damage. Impact Blow: During your next
// turn, this Pokémon can't use Impact Blow.
defineCard('ASC-121', { attacks: {
  *'Orichalcum Fang'(a) { hitPlus(a, sel.knockedOutLastTurn(a, a.me, { byAttack: true }) ? 120 : 0) },
  *'Impact Blow'(a) { damageActive(a, a.base); cantUseNextTurn(a) },
} })

// Talonflame ex — Excited Dive: Once during your turn, if this Pokémon is in your hand, and if you
// have any {C} Mega Evolution Pokémon ex in play, you may use this Ability. Put this Pokémon onto
// your Bench. Talon Hunt: You may search your deck for up to 2 cards and put them into your hand.
defineCard('DLR-88', {
  abilities: { 'Excited Dive': {
    fromHand: true,
    canUse: x => inPlayOf(x, x.me, sel.and(sel.mega, sel.ex, sel.ofType('Colorless'))).length > 0 && x.s.players[x.me].bench.length < sel.benchRoom(x, x.me),
    *use(x) { yield* putOntoBench(x, x.card!) },
  } },
  attacks: { *'Talon Hunt'(a) {
    damageActive(a, a.base)
    const picks = yield* searchDeck(a, { filter: sel.any, max: 2, title: 'You may choose up to 2 cards' })
    moveCards(a, picks, 'hand')
    shuffleDeck(a, a.me)
  } },
})

// Lillie's Clefairy ex — Fairy Zone: The Weakness of each of your opponent's {N} Pokémon in play is
// now {P}. Full Moon Rondo: This attack does 20 more damage for each Benched Pokémon (both yours and your opponent's).
defineCard('JTG-56', {
  abilities: { 'Fairy Zone': { modifiers: {
    weakness: (src, ctx, slot, w) => (sel.ownerOfSlot(ctx, slot) !== src.player && is(ctx, slot, sel.ofType('Dragon')) ? { type: 'Psychic', value: '×2' } : w),
  } } },
  attacks: { *'Full Moon Rondo'(a) { hitPlus(a, 20 * (bench(a, a.me).length + bench(a, a.opp).length)) } },
})

// Mega Kangaskhan ex — Run Errand: Once during your turn, if this Pokémon is in the Active Spot, you
// may use this Ability. Draw 2 cards. You can't use more than 1 Run Errand Ability each turn.
// Rapid-Fire Combo: Flip a coin until you get tails. This attack does 50 more damage for each heads.
defineCard('MEG-104', {
  abilities: { 'Run Errand': { group: 'Run Errand', canUse: x => !!x.self && isActive(x, x.self), *use(x) { draw(x, 2) } } },
  attacks: { *'Rapid-Fire Combo'(a) { hitPlus(a, 50 * flipUntilTails(a)) } },
})

// Passimian — Coordinated Throwing: This attack does 20 damage for each of your Basic Pokémon in play.
defineCard('SSP-111', { attacks: { *'Coordinated Throwing'(a) { hitTimes(a, inPlayOf(a, a.me, sel.basicPokemon).length) } } })

// Chien-Pao — Snow Sink: When you play this Pokémon from your hand onto your Bench during your turn,
// you may discard a Stadium in play. Icicle Loop: Put an Energy attached to this Pokémon into your hand.
defineCard('SSP-56', {
  abilities: { 'Snow Sink': { on: { *playedToBench(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || x.s.stadium === null) return
    if (yield* may(x, 'Snow Sink: discard the Stadium in play?')) yield* discardStadium(x)
  } } } },
  attacks: { *'Icicle Loop'(a) {
    damageActive(a, a.base)
    const [uid] = yield* chooseCards(a, { title: 'Put an Energy attached to this Pokémon into your hand', options: a.attacker.energy })
    if (uid !== undefined) moveCards(a, [uid], 'hand')
  } },
})

// Latias ex — Skyliner: Your Basic Pokémon in play have no Retreat Cost. Eon Blade: During your next
// turn, this Pokémon can't attack.
defineCard('SSP-76', {
  abilities: { Skyliner: { modifiers: {
    retreatCost: (src, ctx, slot) => (sel.ownerOfSlot(ctx, slot) === src.player && is(ctx, slot, sel.basicPokemon) ? 'none' : 0),
  } } },
  attacks: { *'Eon Blade'(a) { damageActive(a, a.base); cantAttackNextTurn(a) } },
})

// Raging Bolt ex — Burst Roar: Discard your hand and draw 6 cards. Bellowing Thunder: You may discard
// any amount of Basic Energy from your Pokémon. This attack does 70 damage for each card discarded.
defineCard('TEF-123', { attacks: {
  *'Burst Roar'(a) { discardHand(a); draw(a, 6) },
  *'Bellowing Thunder'(a) {
    const options = inPlayOf(a, a.me).flatMap(s => matching(a, s.energy, sel.basicEnergy()))
    const picks = yield* chooseCards(a, { title: 'Discard any amount of Basic Energy from your Pokémon', options, min: 0, max: options.length })
    yield* discardAttached(a, picks)
    hitTimes(a, picks.length)
  },
} })

// Teal Mask Ogerpon ex — Teal Dance: Once during your turn, you may attach a Basic {G} Energy card
// from your hand to this Pokémon. If you attached Energy in this way, draw a card. Myriad Leaf Shower:
// This attack does 30 more damage for each Energy attached to both Active Pokémon.
defineCard('TWM-25', {
  abilities: { 'Teal Dance': {
    canUse: x => matching(x, x.s.players[x.me].hand, sel.basicEnergy('Grass')).length > 0,
    *use(x) {
      const [uid] = yield* chooseCards(x, { title: 'Attach a Basic {G} Energy', options: matching(x, x.s.players[x.me].hand, sel.basicEnergy('Grass')) })
      if (uid === undefined || !x.self) return
      yield* attachEnergy(x, uid, x.self)
      draw(x, 1)
    },
  } },
  attacks: { *'Myriad Leaf Shower'(a) {
    const opp = active(a, a.opp)
    hitPlus(a, 30 * (energyCount(a, a.attacker) + (opp ? energyCount(a, opp) : 0)))
  } },
})

// Wellspring Mask Ogerpon ex — Sob: During your opponent's next turn, the Defending Pokémon can't
// retreat. Torrential Pump: You may shuffle 3 Energy attached to this Pokémon into your deck. If you
// do, this attack also does 120 damage to 1 of your opponent's Benched Pokémon.
defineCard('TWM-64', { attacks: {
  *Sob(a) { damageActive(a, a.base); defenderCantRetreat(a) },
  *'Torrential Pump'(a) {
    damageActive(a, a.base)
    if (a.attacker.energy.length < 3 || !(yield* may(a, 'Shuffle 3 Energy into your deck for 120 to a Benched Pokémon?'))) return
    const picks = yield* chooseCards(a, { title: 'Shuffle 3 Energy into your deck', options: a.attacker.energy, min: 3, max: 3 })
    moveCards(a, picks, 'deckBottom')
    shuffleDeck(a, a.me)
    const [t] = yield* choosePokemon(a, { title: 'Do 120 damage to 1 of your opponent\'s Benched Pokémon', options: bench(a, a.opp) })
    if (t) damage(a, t, 120)
  },
} })

