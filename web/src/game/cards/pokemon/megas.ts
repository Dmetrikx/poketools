// Mega Evolution archetypes: Mega Charizard X / Y, Greninja and Mega Greninja, Mega Froslass,
// Mega Starmie, Mega Lopunny, Mega Lucario + Hariyama, Mega Venusaur, Mega Sharpedo + Toxtricity,
// and Mew Box (Mega Latias ex, Unown, Iron Crown ex).

import {
  addMarker, applyCondition, attachEnergy, chooseCards, choosePokemon, damage, damageActive, defineCard,
  discardAllEnergy, discardAttached, discardFromHand, draw, flip, gust, heal, isFirstTurn, matching,
  may, moveCards, moveEnergy, placeCounters, searchDeck, searchToBench, searchToHand, sel, selfDamage, shuffleDeck,
  switchOwn, thisTurn, topCards, log, nameOf,
} from '../fx'
import { EXTRA_PRIZE, cantUseNextTurn, defenderCantRetreat, defenderDealsLess, hitPlus, hitTimes } from './common'

const { active, bench, energyOn, inPlayOf, is, isActive, ownerOfSlot } = sel

// ── Mega Charizard ───────────────────────────────────────────────────────

// Mega Charizard X ex — Inferno X: Discard any amount of {R} Energy from among your Pokémon, and this
// attack does 90 damage for each card you discarded in this way.
defineCard('PFL-13', { attacks: { *'Inferno X'(a) {
  const options = inPlayOf(a, a.me).flatMap(s => energyOn(a, s, 'Fire'))
  const picks = yield* chooseCards(a, { title: 'Discard any amount of {R} Energy from your Pokémon', options, min: 0, max: options.length })
  yield* discardAttached(a, picks)
  hitTimes(a, picks.length)
} } })

// Mega Charizard Y ex — Explosion Y: Discard 3 Energy from this Pokémon, and this attack does 280
// damage to 1 of your opponent's Pokémon.
defineCard('ASC-22', { attacks: { *'Explosion Y'(a) {
  const picks = yield* chooseCards(a, { title: 'Discard 3 Energy from this Pokémon', options: a.attacker.energy, min: 3, max: 3 })
  yield* discardAttached(a, picks)
  const [t] = yield* choosePokemon(a, { title: 'Do 280 damage to 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
  if (t) damage(a, t, 280)
} } })

// Charmander (PFL) — Agile: If this Pokémon has no Energy attached, it has no Retreat Cost.
defineCard('PFL-11', { abilities: { Agile: { modifiers: {
  retreatCost: (src, _c, slot) => (src.slot?.id === slot.id && slot.energy.length === 0 ? 'none' : 0),
} } } })

// Oricorio ex — Excited Turbo: As often as you like during your turn, if you have any {R} Mega
// Evolution Pokémon ex in play, you may use this Ability. Attach a Basic {R} Energy card from your
// hand to 1 of your Benched {R} Pokémon.
defineCard('PFL-18', { abilities: { 'Excited Turbo': {
  limit: 'repeatable',
  canUse: x => inPlayOf(x, x.me, sel.and(sel.mega, sel.ex, sel.ofType('Fire'))).length > 0 &&
    bench(x, x.me, sel.ofType('Fire')).length > 0 && matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fire')).length > 0,
  *use(x) {
    const [uid] = yield* chooseCards(x, { title: 'Attach a Basic {R} Energy', options: matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fire')) })
    const [slot] = yield* choosePokemon(x, { title: 'To 1 of your Benched {R} Pokémon', options: bench(x, x.me, sel.ofType('Fire')) })
    if (uid !== undefined && slot) yield* attachEnergy(x, uid, slot)
  },
} } })

// ── Greninja ─────────────────────────────────────────────────────────────

// Mega Greninja ex — Mortal Shuriken: Once during your turn, if this Pokémon is in the Active Spot,
// you may discard a Basic {W} Energy card from your hand in order to use this Ability. Place 6
// damage counters on 1 of your opponent's Pokémon. Ninja Spinner: You may put a {W} Energy attached
// to this Pokémon into your hand and have this attack do 80 more damage.
defineCard('CRI-22', {
  abilities: { 'Mortal Shuriken': {
    canUse: x => !!x.self && isActive(x, x.self) && matching(x, x.s.players[x.me].hand, sel.basicEnergy('Water')).length > 0,
    *use(x) {
      yield* discardFromHand(x, { filter: sel.basicEnergy('Water'), min: 1, max: 1, title: 'Discard a Basic {W} Energy' })
      const [t] = yield* choosePokemon(x, { title: 'Place 6 damage counters on 1 of your opponent\'s Pokémon', options: inPlayOf(x, x.opp) })
      if (t) placeCounters(x, t, 6)
    },
  } },
  attacks: { *'Ninja Spinner'(a) {
    const water = energyOn(a, a.attacker, 'Water')
    let bonus = 0
    if (water.length && (yield* may(a, 'Put a {W} Energy into your hand for 80 more damage?'))) {
      const [uid] = yield* chooseCards(a, { title: 'Put a {W} Energy into your hand', options: water })
      moveCards(a, [uid], 'hand')
      bonus = 80
    }
    hitPlus(a, bonus)
  } },
})

// Greninja ex (30C) — Stealthy Slash: This attack does 30 damage to 1 of your opponent's Pokémon for
// each damage counter on that Pokémon.
defineCard('30C-21', { attacks: { *'Stealthy Slash'(a) {
  const [t] = yield* choosePokemon(a, { title: 'Choose 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
  if (t) damage(a, t, 30 * (t.damage / 10))
} } })

// Greninja ex (TWM) — Shinobi Blade: You may search your deck for a card… Mirage Barrage: Discard 2
// Energy from this Pokémon. This attack does 120 damage to 2 of your opponent's Pokémon.
defineCard('TWM-106', { attacks: {
  *'Shinobi Blade'(a) {
    damageActive(a, a.base)
    const picks = yield* searchDeck(a, { filter: sel.any, title: 'You may choose a card' })
    moveCards(a, picks, 'hand')
    shuffleDeck(a, a.me)
  },
  *'Mirage Barrage'(a) {
    const picks = yield* chooseCards(a, { title: 'Discard 2 Energy from this Pokémon', options: a.attacker.energy, min: 2, max: 2 })
    yield* discardAttached(a, picks)
    const targets = yield* choosePokemon(a, { title: 'Do 120 damage to 2 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp), min: 2, max: 2 })
    for (const t of targets) damage(a, t, 120)
  },
} })

// Froakie — Collect: Draw a card. Frogadier — Summoning Jutsu: Search your deck for up to 3 Pokémon…
defineCard('CRI-20', { attacks: { *Collect(a) { draw(a, 1) } } })
defineCard('CRI-21', { attacks: { *'Summoning Jutsu'(a) { yield* searchToHand(a, { filter: sel.pokemon, max: 3, title: 'Choose up to 3 Pokémon' }) } } })

// Mega Froslass ex — Resentful Refrain: 50 damage for each card in your opponent's hand. Absolute
// Snow: Your opponent's Active Pokémon is now Asleep.
defineCard('ASC-47', { attacks: {
  *'Resentful Refrain'(a) { hitTimes(a, a.s.players[a.opp].hand.length) },
  *'Absolute Snow'(a) { damageActive(a, a.base); const d = active(a, a.opp); if (d) applyCondition(a, d, 'asleep') },
} })

// Mega Starmie ex — Jetting Blow: also does 50 damage to 1 of your opponent's Benched Pokémon.
// Nebula Beam: isn't affected by Weakness or Resistance, or by any effects on your opponent's Active Pokémon.
defineCard('POR-21', { attacks: {
  *'Jetting Blow'(a) {
    damageActive(a, a.base)
    const [t] = yield* choosePokemon(a, { title: 'Do 50 damage to 1 of your opponent\'s Benched Pokémon', options: bench(a, a.opp) })
    if (t) damage(a, t, 50)
  },
  *'Nebula Beam'(a) { damageActive(a, a.base, { ignoreWeakness: true, ignoreResistance: true, ignoreDefenderEffects: true }) },
} })

// ── Mega Lopunny ─────────────────────────────────────────────────────────

// Mega Lopunny ex — Gale Thrust: If this Pokémon moved from your Bench to the Active Spot this turn,
// this attack does 170 more damage. Spiky Hopper: isn't affected by any effects on your opponent's Active Pokémon.
defineCard('PFL-84', { attacks: {
  *'Gale Thrust'(a) { hitPlus(a, thisTurn(a).movedToActive.includes(a.attacker.id) ? 170 : 0) },
  *'Spiky Hopper'(a) { damageActive(a, a.base, { ignoreDefenderEffects: true }) },
} })

// Buneary (MEG) — Charm: During your opponent's next turn, attacks used by the Defending Pokémon do 20
// less damage (before applying Weakness and Resistance).
defineCard('MEG-107', { attacks: { *Charm(a) { defenderDealsLess(a, 20) } } })

// Buneary (PFL) — Run Around: Switch this Pokémon with 1 of your Benched Pokémon.
defineCard('PFL-83', { attacks: { *'Run Around'(a) { yield* switchOwn(a) } } })

// Fan Rotom — Fan Call: Once during your first turn, you may search your deck for up to 3 {C} Pokémon
// with 100 HP or less… You can't use more than 1 Fan Call Ability during your turn.
// Assault Landing: If there is no Stadium in play, this attack does nothing.
defineCard('SCR-118', {
  abilities: { 'Fan Call': {
    group: 'Fan Call',
    canUse: x => isFirstTurn(x, x.me),
    *use(x) { yield* searchToHand(x, { filter: sel.and(sel.ofType('Colorless'), sel.hpAtMost(100)), max: 3, title: 'Choose up to 3 {C} Pokémon with 100 HP or less' }) },
  } },
  attacks: { *'Assault Landing'(a) { if (a.s.stadium !== null) damageActive(a, a.base) } },
})

// Abra (MEG) — Teleportation Attack: Switch this Pokémon with 1 of your Benched Pokémon.
defineCard('MEG-54', { attacks: { *'Teleportation Attack'(a) { damageActive(a, a.base); yield* switchOwn(a) } } })

// ── Mega Lucario + Hariyama ──────────────────────────────────────────────

// Mega Lucario ex — Aura Jab: Attach up to 3 Basic {F} Energy cards from your discard pile to your
// Benched Pokémon in any way you like. Mega Brave: During your next turn, this Pokémon can't use Mega Brave.
defineCard('MEG-77', { attacks: {
  *'Aura Jab'(a) {
    damageActive(a, a.base)
    const picks = yield* chooseCards(a, { title: 'Attach up to 3 Basic {F} Energy from your discard pile', options: matching(a, a.s.players[a.me].discard, sel.basicEnergy('Fighting')), min: 0, max: 3 })
    for (const uid of picks) {
      const [slot] = yield* choosePokemon(a, { title: `Attach ${nameOf(a, uid)} to…`, options: bench(a, a.me) })
      if (slot) yield* attachEnergy(a, uid, slot)
    }
  },
  *'Mega Brave'(a) { damageActive(a, a.base); cantUseNextTurn(a) },
} })

// Riolu (MEG) — Accelerating Stab: During your next turn, this Pokémon can't use Accelerating Stab.
defineCard('MEG-76', { attacks: { *'Accelerating Stab'(a) { damageActive(a, a.base); cantUseNextTurn(a) } } })

// Riolu (PRE) — Quick Attack: Flip a coin. If heads, this attack does 20 more damage.
defineCard('PRE-50', { attacks: { *'Quick Attack'(a) { hitPlus(a, flip(a) ? 20 : 0) } } })

// Hariyama — Heave-Ho Catcher: Once during your turn, when you play this Pokémon from your hand to
// evolve 1 of your Pokémon, you may use this Ability. Switch in 1 of your opponent's Benched Pokémon
// to the Active Spot. Wild Press: This Pokémon also does 70 damage to itself.
defineCard('MEG-73', {
  abilities: { 'Heave-Ho Catcher': { on: { *evolved(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || !bench(x, x.opp).length) return
    if (yield* may(x, 'Use Heave-Ho Catcher?')) yield* gust(x)
  } } } },
  attacks: { *'Wild Press'(a) { damageActive(a, a.base); selfDamage(a, 70) } },
})

// Lunatone — Lunar Cycle: Once during your turn, if you have Solrock in play, you may discard a Basic
// {F} Energy card from your hand in order to use this Ability. Draw 3 cards. You can't use more than
// 1 Lunar Cycle Ability each turn.
defineCard('MEG-74', { abilities: { 'Lunar Cycle': {
  group: 'Lunar Cycle',
  canUse: x => inPlayOf(x, x.me, sel.named('Solrock')).length > 0 && matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fighting')).length > 0,
  *use(x) {
    yield* discardFromHand(x, { filter: sel.basicEnergy('Fighting'), min: 1, max: 1, title: 'Discard a Basic {F} Energy' })
    draw(x, 3)
  },
} } })

// Solrock — Cosmic Beam: If you don't have Lunatone on your Bench, this attack does nothing. This
// attack's damage isn't affected by Weakness or Resistance.
defineCard('MEG-75', { attacks: { *'Cosmic Beam'(a) {
  if (bench(a, a.me, sel.named('Lunatone')).length) damageActive(a, a.base, { ignoreWeakness: true, ignoreResistance: true })
} } })

// ── Mega Venusaur ────────────────────────────────────────────────────────

// Mega Venusaur ex — Solar Transfer: As often as you like during your turn, you may use this Ability.
// Move a Basic {G} Energy from 1 of your Pokémon to another of your Pokémon. Jungle Dump: Heal 30
// damage from this Pokémon.
defineCard('MEG-3', {
  abilities: { 'Solar Transfer': {
    limit: 'repeatable',
    canUse: x => inPlayOf(x, x.me).length > 1 && inPlayOf(x, x.me).some(s => matching(x, s.energy, sel.basicEnergy('Grass')).length),
    *use(x) {
      const options = inPlayOf(x, x.me).flatMap(s => matching(x, s.energy, sel.basicEnergy('Grass')))
      const [uid] = yield* chooseCards(x, { title: 'Move a Basic {G} Energy', options })
      if (uid === undefined) return
      const from = inPlayOf(x, x.me).find(s => s.energy.includes(uid))!
      const [to] = yield* choosePokemon(x, { title: 'To another of your Pokémon', options: inPlayOf(x, x.me).filter(s => s.id !== from.id) })
      if (to) moveEnergy(x, uid, to)
    },
  } },
  attacks: { *'Jungle Dump'(a) { damageActive(a, a.base); heal(a, a.attacker, 30) } },
})

// Bulbasaur (MEG) — Bind Down: During your opponent's next turn, the Defending Pokémon can't retreat.
defineCard('MEG-1', { attacks: { *'Bind Down'(a) { damageActive(a, a.base); defenderCantRetreat(a) } } })

// Chikorita (ASC) — Growl: attacks used by the Defending Pokémon do 20 less damage during your opponent's next turn.
defineCard('ASC-8', { attacks: { *Growl(a) { defenderDealsLess(a, 20) } } })

// Regigigas — Jewel Breaker: If your opponent's Active Pokémon is a Tera Pokémon, this attack does 230 more damage.
defineCard('PRE-86', { attacks: { *'Jewel Breaker'(a) { const d = active(a, a.opp); hitPlus(a, d && is(a, d, sel.tera) ? 230 : 0) } } })

// ── Mega Sharpedo + Toxtricity ───────────────────────────────────────────

// Mega Sharpedo ex — Greedy Fang: Draw 2 cards. Hungry Jaws: If this Pokémon has any damage counters
// on it, this attack does 150 more damage.
defineCard('PFL-61', { attacks: {
  *'Greedy Fang'(a) { damageActive(a, a.base); draw(a, 2) },
  *'Hungry Jaws'(a) { hitPlus(a, a.attacker.damage > 0 ? 150 : 0) },
} })

// Carvanha — Reckless Charge: This Pokémon also does 10 damage to itself.
defineCard('PFL-60', { attacks: { *'Reckless Charge'(a) { damageActive(a, a.base); selfDamage(a, 10) } } })

// Toxel — Call for Family: Search your deck for up to 2 Basic Pokémon and put them onto your Bench.
defineCard('PFL-67', { attacks: { *'Call for Family'(a) { yield* searchToBench(a, { filter: sel.basicPokemon, max: 2, title: 'Choose up to 2 Basic Pokémon' }) } } })

// Toxtricity — Sinister Surge: Once during your turn, you may use this Ability. Search your deck for a
// Basic {D} Energy card and attach it to 1 of your Benched {D} Pokémon. Then, shuffle your deck. If you
// attached Energy to a Pokémon in this way, place 2 damage counters on that Pokémon.
defineCard('PFL-68', { abilities: { 'Sinister Surge': {
  canUse: x => bench(x, x.me, sel.ofType('Darkness')).length > 0,
  *use(x) {
    const [uid] = yield* searchDeck(x, { filter: sel.basicEnergy('Darkness'), title: 'Choose a Basic {D} Energy' })
    if (uid !== undefined) {
      const [slot] = yield* choosePokemon(x, { title: 'Attach it to 1 of your Benched {D} Pokémon', options: bench(x, x.me, sel.ofType('Darkness')) })
      if (slot) {
        yield* attachEnergy(x, uid, slot)
        placeCounters(x, slot, 2)
      }
    }
    shuffleDeck(x, x.me)
  },
} } })

// Yveltal (MEG) — Clutch: During your opponent's next turn, the Defending Pokémon can't retreat.
defineCard('MEG-88', { attacks: { *Clutch(a) { damageActive(a, a.base); defenderCantRetreat(a) } } })

// Tatsugiri — Attract Customers: Once during your turn, if this Pokémon is in the Active Spot, you may
// look at the top 6 cards of your deck, reveal a Supporter card you find there, and put it into your
// hand. Shuffle the other cards back into your deck.
defineCard('TWM-131', { abilities: { 'Attract Customers': {
  canUse: x => !!x.self && isActive(x, x.self) && x.s.players[x.me].deck.length > 0,
  *use(x) {
    const [uid] = yield* chooseCards(x, { title: 'Take a Supporter', options: matching(x, topCards(x, 6), sel.trainerOf('Supporter')), min: 0, max: 1 })
    if (uid !== undefined) {
      moveCards(x, [uid], 'hand')
      log(x, x.me, `Puts ${nameOf(x, uid)} into their hand.`)
    }
    shuffleDeck(x, x.me)
  },
} } })

// ── Mew Box ──────────────────────────────────────────────────────────────

// Mega Latias ex — Strafe: You may switch this Pokémon with 1 of your Benched Pokémon. Illusory
// Impulse: Discard all Energy from this Pokémon.
defineCard('MEG-100', { attacks: {
  *Strafe(a) {
    damageActive(a, a.base)
    if (bench(a, a.me).length && (yield* may(a, 'Switch this Pokémon with 1 of your Benched Pokémon?'))) yield* switchOwn(a)
  },
  *'Illusory Impulse'(a) { damageActive(a, a.base); yield* discardAllEnergy(a, a.attacker) },
} })

// Unown (30C) — Mysterious Signal: If your opponent's Pokémon is Knocked Out by damage from this
// attack, take 1 more Prize card.
defineCard('30C-72', { attacks: { *'Mysterious Signal'(a) {
  addMarker(a, EXTRA_PRIZE, { until: 'thisTurn', slot: a.attacker })
  damageActive(a, a.base)
} } })

// Iron Crown ex — Cobalt Command: Attacks used by your Future Pokémon, except any Iron Crown ex, do 20
// more damage to your opponent's Active Pokémon (before applying Weakness and Resistance). Twin
// Shotels: This attack does 50 damage to 2 of your opponent's Pokémon. This attack's damage isn't
// affected by Weakness or Resistance, or by any effects on those Pokémon.
defineCard('TEF-81', {
  abilities: { 'Cobalt Command': { modifiers: {
    damageDealt: (src, ctx, ev) => (ev.toActive && ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, sel.tagged('Future')) &&
      sel.card(ctx, ev.attacker).name !== 'Iron Crown ex' ? 20 : 0),
  } } },
  attacks: { *'Twin Shotels'(a) {
    const targets = yield* choosePokemon(a, { title: 'Do 50 damage to 2 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp), min: 2, max: 2 })
    for (const t of targets) damage(a, t, 50, { ignoreWeakness: true, ignoreResistance: true, ignoreDefenderEffects: true })
  } },
})

