// N's Zoroark (N's Zekrom, N's Zoroark ex, Pecharunt ex) and Slowking (Mew ex, Metagross,
// Zeraora, Slowpoke, Slowking, Kyurem).

import {
  applyCondition, chooseCards, choosePokemon, damage, damageActive, defineCard, discardAllEnergy,
  discardAttached, discardFromHand, draw, log, matching, may, moveCards, nameOf, pushOut, reaches, sel,
  switchIn, switchOwn,
} from '../fx'
import { cantAttackNextTurn, copyFrom, copyFromSlots, hitPlus, hitTimes } from './common'

const { bench, inPlayOf, prizesTaken } = sel

// N's Zekrom — Shred: This attack's damage isn't affected by any effects on your opponent's Active
// Pokémon. Rampaging Thunder: During your next turn, this Pokémon can't use attacks.
defineCard('ASC-155', { attacks: {
  *Shred(a) { damageActive(a, a.base, { ignoreDefenderEffects: true }) },
  *'Rampaging Thunder'(a) { damageActive(a, a.base); cantAttackNextTurn(a) },
} })

// N's Zoroark ex — Trade: You must discard a card from your hand in order to use this Ability. Once
// during your turn, you may draw 2 cards. Night Joker: Choose 1 of your Benched N's Pokémon's
// attacks and use it as this attack.
defineCard('JTG-98', {
  abilities: { Trade: {
    canUse: x => x.s.players[x.me].hand.length > 0,
    *use(x) {
      yield* discardFromHand(x, { min: 1, max: 1, title: 'Discard a card to use Trade' })
      draw(x, 2)
    },
  } },
  attacks: { *'Night Joker'(a) {
    yield* copyFromSlots(a, bench(a, a.me, sel.tagged("N's")), 'Choose 1 of your Benched N\'s Pokémon\'s attacks')
  } },
})

// Pecharunt ex — Subjugating Chains: Once during your turn, you may switch 1 of your Benched {D}
// Pokémon, except any Pecharunt ex, with your Active Pokémon. If you do, the new Active Pokémon is
// now Poisoned. You can't use more than 1 Subjugating Chains Ability each turn.
// Irritated Outburst: This attack does 60 damage for each Prize card your opponent has taken.
const chainTargets = (x: Parameters<typeof bench>[0], me: 0 | 1) =>
  bench(x, me, c => sel.ofType('Darkness')(c) && c.name !== 'Pecharunt ex')
defineCard('SFA-39', {
  abilities: { 'Subjugating Chains': {
    group: 'Subjugating Chains',
    canUse: x => !!x.s.players[x.me].active && chainTargets(x, x.me).length > 0,
    *use(x) {
      const now = yield* switchIn(x, x.me, x.me, 'Switch in 1 of your Benched {D} Pokémon', chainTargets(x, x.me))
      if (now) applyCondition(x, now, 'poisoned')
    },
  } },
  attacks: { *'Irritated Outburst'(a) { hitTimes(a, prizesTaken(a, a.opp)) } },
})

// Mew ex — Memory Helix: This Pokémon can use the attacks of any of your Benched Pokémon. (You still
// need the necessary Energy to use each attack.) Teleportation Burst: You may switch this Pokémon
// with 1 of your Benched Pokémon.
defineCard('30C-66', {
  abilities: { 'Memory Helix': { modifiers: {
    extraAttacks: (src, ctx, slot) => {
      if (src.slot?.id !== slot.id) return []
      return bench(ctx, src.player).flatMap(b => (sel.card(ctx, b).attacks ?? []).map(at => ({ cardId: sel.card(ctx, b).id, attack: at.name })))
    },
  } } },
  attacks: { *'Teleportation Burst'(a) {
    damageActive(a, a.base)
    if (bench(a, a.me).length && (yield* may(a, 'Switch this Pokémon with 1 of your Benched Pokémon?'))) yield* switchOwn(a)
  } },
})

// Metagross — Bounce Back: Switch out your opponent's Active Pokémon to the Bench. (Your opponent
// chooses the new Active Pokémon.) Metallic Hammer: You may discard 3 {M} Energy from this Pokémon
// and have this attack do 150 more damage.
defineCard('CRI-61', { attacks: {
  *'Bounce Back'(a) { damageActive(a, a.base); if (a.defender && reaches(a, a.defender)) yield* pushOut(a) },
  *'Metallic Hammer'(a) {
    const metal = sel.energyOn(a, a.attacker, 'Metal')
    let bonus = 0
    if (metal.length >= 3 && (yield* may(a, 'Discard 3 {M} Energy for 150 more damage?'))) {
      const picks = yield* chooseCards(a, { title: 'Discard 3 {M} Energy', options: metal, min: 3, max: 3 })
      yield* discardAttached(a, picks)
      bonus = 150
    }
    hitPlus(a, bonus)
  },
} })

// Zeraora — Thunder Raid: Discard all Energy from this Pokémon, and this attack does 210 damage to 1
// of your opponent's Benched Pokémon ex.
defineCard('DRI-78', { attacks: { *'Thunder Raid'(a) {
  yield* discardAllEnergy(a, a.attacker)
  const [t] = yield* choosePokemon(a, { title: 'Do 210 damage to 1 of your opponent\'s Benched Pokémon ex', options: bench(a, a.opp, sel.ex) })
  if (t) damage(a, t, 210)
} } })

// Slowpoke (SCR) — Dangle Tail: Put a Pokémon from your discard pile into your hand.
defineCard('SCR-57', { attacks: { *'Dangle Tail'(a) {
  const [uid] = yield* chooseCards(a, { title: 'Put a Pokémon from your discard pile into your hand', options: matching(a, a.s.players[a.me].discard, sel.pokemon) })
  if (uid !== undefined) moveCards(a, [uid], 'hand')
} } })

// Slowking — Seek Inspiration: Discard the top card of your deck, and if that card is a Pokémon that
// doesn't have a Rule Box, choose 1 of its attacks and use it as this attack.
defineCard('SCR-58', { attacks: { *'Seek Inspiration'(a) {
  const [top] = a.s.players[a.me].deck
  if (top === undefined) return
  moveCards(a, [top], 'discard')
  log(a, a.me, `Discards ${nameOf(a, top)} from the top of their deck.`)
  const card = a.db.card(a.s.cards[top].cardId)
  if (sel.noRuleBox(card)) yield* copyFrom(a, card.id, `Use 1 of ${card.name}'s attacks`)
} } })

// Kyurem — Plasma Bane: If your opponent has any cards in their discard pile that have "Colress" in
// the name, this Pokémon can use the Trifrost attack for {C}. Trifrost: Discard all Energy from this
// Pokémon. This attack does 110 damage to 3 of your opponent's Pokémon.
defineCard('SFA-47', {
  abilities: { 'Plasma Bane': { modifiers: {
    attackCost: (src, ctx, slot, attack, cost) => {
      if (src.slot?.id !== slot.id || attack.name !== 'Trifrost') return cost
      const colress = ctx.s.players[src.player === 0 ? 1 : 0].discard.some(u => ctx.db.card(ctx.s.cards[u].cardId).name.includes('Colress'))
      return colress ? ['Colorless'] : cost
    },
  } } },
  attacks: { *Trifrost(a) {
    yield* discardAllEnergy(a, a.attacker)
    const targets = yield* choosePokemon(a, { title: 'Do 110 damage to 3 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp), min: 3, max: 3 })
    for (const t of targets) damage(a, t, 110)
  } },
})

