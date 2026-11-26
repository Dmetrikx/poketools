// Dragapult and the shared engine Pokémon most decks play.

import {
  addMarker, applyCondition, chooseCards, chooseOption, choosePokemon, damage, damageActive, defineCard,
  distributeCounters, draw, flip, log, may, moveCards, moveCounters, removePokemon, searchToHand, sel, switchOwn,
  type Proc, type X,
} from '../fx'
import { NO_ITEMS, SHIELDED, claimGroup, groupFree, hitTimes } from './common'

const { bench, inPlayOf, energyOn } = sel

// Fezandipiti ex — Flip the Script: Once during your turn, if any of your Pokémon were Knocked Out
// during your opponent's last turn, you may draw 3 cards. You can't use more than 1 Flip the Script
// Ability each turn. Cruel Arrow: This attack does 100 damage to 1 of your opponent's Pokémon.
defineCard('ASC-142', {
  abilities: { 'Flip the Script': {
    group: 'Flip the Script',
    canUse: x => sel.knockedOutLastTurn(x, x.me),
    *use(x) { draw(x, 3) },
  } },
  attacks: { *'Cruel Arrow'(a) {
    const [t] = yield* choosePokemon(a, { title: 'Do 100 damage to 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
    if (t) damage(a, t, 100)
  } },
})

// Budew — Itchy Pollen: During your opponent's next turn, they can't play any Item cards from their hand.
defineCard('ASC-16', { attacks: { *'Itchy Pollen'(a) {
  damageActive(a, a.base)
  addMarker(a, NO_ITEMS, { until: 'opponentsNextTurn' })
} } })

// Meowth ex — Last-Ditch Catch: Once during your turn, when you play this Pokémon from your hand onto
// your Bench, you may use this Ability. Search your deck for a Supporter card… You can't use more
// than 1 Ability that has "Last-Ditch" in its name each turn. Tuck Tail: Put this Pokémon and all
// attached cards into your hand.
defineCard('POR-62', {
  abilities: { 'Last-Ditch Catch': { on: { *playedToBench(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || !groupFree(x, 'Last-Ditch')) return
    if (!(yield* may(x, 'Use Last-Ditch Catch?'))) return
    claimGroup(x, 'Last-Ditch')
    yield* searchToHand(x, { filter: sel.trainerOf('Supporter'), title: 'Choose a Supporter' })
  } } } },
  attacks: { *'Tuck Tail'(a) {
    damageActive(a, a.base)
    yield* removePokemon(a, a.attacker, 'hand')
  } },
})

// Dunsparce (JTG) — Trading Places: Switch this Pokémon with 1 of your Benched Pokémon.
defineCard('JTG-120', { attacks: { *'Trading Places'(a) { yield* switchOwn(a) } } })

// Dunsparce (TEF) — Dig: Flip a coin. If heads, during your opponent's next turn, prevent all damage
// from and effects of attacks done to this Pokémon.
defineCard('TEF-128', { attacks: { *Dig(a) {
  damageActive(a, a.base)
  if (flip(a)) addMarker(a, SHIELDED, { until: 'opponentsNextTurn', slot: a.attacker })
} } })

// Dudunsparce — Run Away Draw: Once during your turn, you may draw 3 cards. If you drew any cards in
// this way, shuffle this Pokémon and all attached cards into your deck.
defineCard('TEF-129', { abilities: { 'Run Away Draw': { *use(x) {
  if (draw(x, 3) > 0 && x.self) yield* removePokemon(x, x.self, 'deck')
} } } })

// Drakloak — Recon Directive: Once during your turn, you may look at the top 2 cards of your deck and
// put 1 of them into your hand. Put the other card on the bottom of your deck.
defineCard('TWM-129', { abilities: { 'Recon Directive': {
  canUse: x => x.s.players[x.me].deck.length > 0,
  *use(x) {
    const top = x.s.players[x.me].deck.slice(0, 2)
    const [pick] = yield* chooseCards(x, { title: 'Put 1 into your hand', options: top })
    moveCards(x, [pick], 'hand')
    const rest = top.filter(u => u !== pick)
    if (rest.length) moveCards(x, rest, 'deckBottom')
    log(x, x.me, 'Puts 1 card into their hand and 1 on the bottom of their deck.')
  },
} } })

// Dragapult ex — Phantom Dive: Put 6 damage counters on your opponent's Benched Pokémon in any way you like.
defineCard('TWM-130', { attacks: { *'Phantom Dive'(a) {
  damageActive(a, a.base)
  yield* distributeCounters(a, 'Put 6 damage counters on your opponent\'s Benched Pokémon', bench(a, a.opp), 6)
} } })

// Munkidori — Adrena-Brain: Once during your turn, if this Pokémon has any {D} Energy attached, you
// may move up to 3 damage counters from 1 of your Pokémon to 1 of your opponent's Pokémon.
// Mind Bend: Your opponent's Active Pokémon is now Confused.
defineCard('TWM-95', {
  abilities: { 'Adrena-Brain': {
    canUse: x => !!x.self && energyOn(x, x.self, 'Darkness').length > 0 && inPlayOf(x, x.me).some(s => s.damage > 0),
    *use(x): Proc {
      const [from] = yield* choosePokemon(x, { title: 'Move damage counters from 1 of your Pokémon', options: inPlayOf(x, x.me).filter(s => s.damage > 0) })
      const [to] = yield* choosePokemon(x, { title: 'To 1 of your opponent\'s Pokémon', options: inPlayOf(x, x.opp) })
      if (!from || !to) return
      const max = Math.min(3, from.damage / 10)
      const n = 1 + (yield* chooseCount(x, max))
      moveCounters(x, from, to, n)
    },
  } },
  attacks: { *'Mind Bend'(a) {
    damageActive(a, a.base)
    if (a.defender) applyCondition(a, a.defender, 'confused')
  } },
})

function* chooseCount(x: X, max: number): Proc<number> {
  if (max <= 1) return 0
  return yield* chooseOption(x, 'How many damage counters?', Array.from({ length: max }, (_, i) => String(i + 1)))
}

// Dudunsparce ex — Tenacious Tail: This attack does 60 damage for each of your opponent's Pokémon ex
// in play. Destructive Drill: This attack's damage isn't affected by any effects on your opponent's Active Pokémon.
defineCard('JTG-121', { attacks: {
  *'Tenacious Tail'(a) { hitTimes(a, inPlayOf(a, a.opp, sel.ex).length) },
  *'Destructive Drill'(a) { damageActive(a, a.base, { ignoreDefenderEffects: true }) },
} })

