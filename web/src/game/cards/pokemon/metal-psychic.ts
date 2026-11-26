// Mega Excadrill (Genesect ex, Shaymin, Drilbur, Mega Excadrill ex, Mega Skarmory ex, Beldum,
// Metang), Alakazam Dudunsparce (Abra, Kadabra, Alakazam, Genesect) and Mega Rayquaza (Mega
// Rayquaza ex, Ethan's Ho-Oh ex, Iron Thorns ex).

import {
  attachEnergy, chooseCards, choosePokemon, damage, damageActive, defineCard, draw, heal, log, may, matching,
  moveCards, moveEnergy, placeCounters, removePokemon, searchToBench, searchToHand, sel, selfDamage, shuffleDeck,
  type AbilityImpl,
} from '../fx'
import { attachFromTop, hitPlus, hitTimes, takesLessNextTurn } from './common'

const { bench, energyCount, energyOn, inPlayOf, is, isActive, ownerOfSlot } = sel

// Genesect ex — Metallic Signal: Once during your turn, you may search your deck for up to 2
// Evolution {M} Pokémon… Protect Charge: During your opponent's next turn, this Pokémon takes 30
// less damage from attacks (after applying Weakness and Resistance).
defineCard('BLK-67', {
  abilities: { 'Metallic Signal': { *use(x) {
    yield* searchToHand(x, { filter: sel.and(sel.evolutionPokemon, sel.ofType('Metal')), max: 2, title: 'Choose up to 2 Evolution {M} Pokémon' })
  } } },
  attacks: { *'Protect Charge'(a) { damageActive(a, a.base); takesLessNextTurn(a, 30) } },
})

// Shaymin — Flower Curtain: Prevent all damage done to your Benched Pokémon that don't have a Rule
// Box by attacks from your opponent's Pokémon.
defineCard('DRI-10', { abilities: { 'Flower Curtain': { modifiers: {
  preventDamage: (src, ctx, ev) => ownerOfSlot(ctx, ev.target) === src.player && !isActive(ctx, ev.target) &&
    is(ctx, ev.target, sel.noRuleBox) && ownerOfSlot(ctx, ev.attacker) !== src.player,
} } } })

// Drilbur — Call for Family: Search your deck for up to 2 Basic Pokémon and put them onto your Bench.
defineCard('PBL-46', { attacks: { *'Call for Family'(a) { yield* searchToBench(a, { filter: sel.basicPokemon, max: 2, title: 'Choose up to 2 Basic Pokémon' }) } } })

// Mega Excadrill ex — Undermine: Discard the top 2 cards of your opponent's deck. Maximum Drilling:
// If this Pokémon has at least 2 extra Energy attached (in addition to this attack's cost), this
// attack does 130 more damage.
defineCard('PBL-65', { attacks: {
  *Undermine(a) {
    damageActive(a, a.base)
    const top = a.s.players[a.opp].deck.slice(0, 2)
    moveCards(a, top, 'discard')
    if (top.length) log(a, a.opp, `Discards ${top.length} cards from the top of their deck.`)
  },
  *'Maximum Drilling'(a) { hitPlus(a, energyCount(a, a.attacker) >= a.attack.cost.length + 2 ? 130 : 0) },
} })

// Mega Skarmory ex — Sonic Ripper: Shuffle all Energy attached to this Pokémon into your deck, and
// this attack does 220 damage to 1 of your opponent's Pokémon.
defineCard('POR-55', { attacks: { *'Sonic Ripper'(a) {
  moveCards(a, [...a.attacker.energy], 'deckBottom')
  shuffleDeck(a, a.me)
  const [t] = yield* choosePokemon(a, { title: 'Do 220 damage to 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
  if (t) damage(a, t, 220)
} } })

// Beldum (TEF) — Iron Tackle: This Pokémon also does 10 damage to itself.
defineCard('TEF-113', { attacks: { *'Iron Tackle'(a) { damageActive(a, a.base); selfDamage(a, 10) } } })

// Metang — Metal Maker: Once during your turn, you may look at the top 4 cards of your deck and
// attach any number of Basic {M} Energy cards you find there to your Pokémon in any way you like.
// Shuffle the other cards and put them on the bottom of your deck.
defineCard('TEF-114', { abilities: { 'Metal Maker': {
  canUse: x => x.s.players[x.me].deck.length > 0,
  *use(x) { yield* attachFromTop(x, 4, sel.basicEnergy('Metal'), 4, () => inPlayOf(x, x.me), 'Attach any number of Basic {M} Energy') },
} } })

// Abra (TWM) — Teleporter: Once during your turn, if this Pokémon is in the Active Spot, you may
// shuffle it and all attached cards into your deck.
defineCard('TWM-80', { abilities: { Teleporter: {
  canUse: x => !!x.self && isActive(x, x.self),
  *use(x) { if (x.self) yield* removePokemon(x, x.self, 'deck') },
} } })

// Kadabra / Alakazam (MEG) — Psychic Draw: Once during your turn, when you play this Pokémon from
// your hand to evolve 1 of your Pokémon, you may use this Ability. Draw 2 (Kadabra) / 3 (Alakazam) cards.
const psychicDraw = (n: number): AbilityImpl => ({ on: { *evolved(x, ev) {
  if (ev.slot.id === x.self?.id && ev.fromHand && (yield* may(x, `Use Psychic Draw (draw ${n})?`))) draw(x, n)
} } })
defineCard('MEG-55', { abilities: { 'Psychic Draw': psychicDraw(2) } })

// Alakazam — Powerful Hand: Place 2 damage counters on your opponent's Active Pokémon for each card in your hand.
defineCard('MEG-56', {
  abilities: { 'Psychic Draw': psychicDraw(3) },
  attacks: { *'Powerful Hand'(a) {
    if (a.defender) placeCounters(a, a.defender, 2 * a.s.players[a.me].hand.length)
  } },
})

// Genesect — ACE Nullifier: If this Pokémon has a Pokémon Tool attached, your opponent can't play any
// ACE SPEC cards from their hand.
defineCard('SFA-40', { abilities: { 'ACE Nullifier': { modifiers: {
  canPlay: (src, ctx, p, uid) => !(p !== src.player && !!src.slot?.tools.length && sel.aceSpec(ctx.db.card(ctx.s.cards[uid].cardId))),
} } } })

// Mega Rayquaza ex — Ruler's Roar: Once during your turn, when you play this Pokémon from your hand
// onto your Bench, you may use this Ability. Look at the top 4 cards of your deck and attach a Basic
// Energy card you find there to this Pokémon. Shuffle the other cards and put them on the bottom of
// your deck. Storm Emerald: This attack does 50 damage for each {R} Energy and each {L} Energy
// attached to all of your Pokémon.
defineCard('DLR-84', {
  abilities: { "Ruler's Roar": { on: { *playedToBench(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || !(yield* may(x, "Use Ruler's Roar?"))) return
    const self = x.self
    yield* attachFromTop(x, 4, sel.basicEnergy(), 1, () => [self], 'Attach a Basic Energy to this Pokémon')
  } } } },
  attacks: { *'Storm Emerald'(a) {
    const n = inPlayOf(a, a.me).reduce((sum, s) => sum + new Set([...energyOn(a, s, 'Fire'), ...energyOn(a, s, 'Lightning')]).size, 0)
    hitTimes(a, n)
  } },
})

// Ethan's Ho-Oh ex — Golden Flame: Once during your turn, you may attach up to 2 Basic {R} Energy
// cards from your hand to 1 of your Benched Ethan's Pokémon. Shining Feathers: Heal 50 damage from
// each of your Pokémon.
defineCard('DRI-39', {
  abilities: { 'Golden Flame': {
    canUse: x => bench(x, x.me, sel.tagged("Ethan's")).length > 0 && matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fire')).length > 0,
    *use(x) {
      const [slot] = yield* choosePokemon(x, { title: "Choose 1 of your Benched Ethan's Pokémon", options: bench(x, x.me, sel.tagged("Ethan's")) })
      const picks = yield* chooseCards(x, { title: 'Attach up to 2 Basic {R} Energy', options: matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fire')), min: 1, max: 2 })
      if (slot) for (const uid of picks) yield* attachEnergy(x, uid, slot)
    },
  } },
  attacks: { *'Shining Feathers'(a) {
    damageActive(a, a.base)
    for (const s of inPlayOf(a, a.me)) heal(a, s, 50)
  } },
})

// Iron Thorns ex — Initialization: As long as this Pokémon is in the Active Spot, Pokémon with a Rule
// Box in play (both yours and your opponent's) have no Abilities, except for Future Pokémon.
// Volt Cyclone: Move an Energy from this Pokémon to 1 of your Benched Pokémon.
defineCard('TWM-77', {
  abilities: { Initialization: { modifiers: {
    noAbilities: (src, ctx, slot) => !!src.slot && isActive(ctx, src.slot) && is(ctx, slot, sel.ruleBox) && !is(ctx, slot, sel.tagged('Future')),
  } } },
  attacks: { *'Volt Cyclone'(a) {
    damageActive(a, a.base)
    if (!a.attacker.energy.length || !bench(a, a.me).length) return
    const [uid] = yield* chooseCards(a, { title: 'Move an Energy from this Pokémon', options: a.attacker.energy })
    const [to] = yield* choosePokemon(a, { title: 'To 1 of your Benched Pokémon', options: bench(a, a.me) })
    if (uid !== undefined && to) moveEnergy(a, uid, to)
  } },
})

