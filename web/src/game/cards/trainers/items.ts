// Items in the LAIC 2026-27 pool, each written from its catalog text.

import {
  addMarker, attachEnergy, bottomCards, chooseCards, chooseOption, choosePokemon, defineCard, defineMarker,
  devolve, discardAttached, discardFromHand, discardStadium, draw, evolveWith, flip, gust, heal, isFirstTurn,
  log, matching, moveCards, moveEnergy, nameOf, removePokemon, searchDeck, searchToBench, searchToHand, sel,
  shuffleDeck, shuffleHandIntoDeck, shuffleInPlace, switchOwn, topCards, handToDeckBottom, type X,
} from '../fx'
import { cardsNamed, fromDiscard, searchEach } from '../helpers'
import type { CardFilter } from '../../effects/select'

const { active, bench, inPlayOf, is, prizesLeft } = sel
/** Cards in hand other than the one being played (it is still in hand when legality is checked). */
const handOthers = (x: X) => x.s.players[x.me].hand.filter(u => u !== x.card).length

/** Look at cards, take up to `max` passing the filter into the hand, shuffle the rest back into the deck. */
function* lookAndTake(x: X, looked: number[], filter: CardFilter, max: number, title: string) {
  const picks = yield* chooseCards(x, { title, options: matching(x, looked, filter), min: 0, max })
  moveCards(x, picks, 'hand')
  if (picks.length) log(x, x.me, `Puts ${picks.map(u => nameOf(x, u)).join(', ')} into their hand.`)
  shuffleDeck(x, x.me)
}

// Adventure Lantern: Search your deck for a Basic {R} Energy card and a Basic {L} Energy card…
defineCard('DLR-90', { trainer: { *play(x) {
  yield* searchEach(x, [[sel.basicEnergy('Fire'), 'Choose a Basic {R} Energy'], [sel.basicEnergy('Lightning'), 'Choose a Basic {L} Energy']])
} } })

// Blowtorch: only if you discard a Basic {R} Energy card from your hand. Discard a Pokémon Tool or
// Special Energy card from 1 of your opponent's Pokémon, or discard a Stadium in play.
defineCard('PFL-86', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fire')).length > 0,
  *play(x) {
    yield* discardFromHand(x, { filter: sel.basicEnergy('Fire'), min: 1, max: 1, title: 'Discard a Basic {R} Energy' })
    const options = inPlayOf(x, x.opp).flatMap(s => [...s.tools, ...matching(x, s.energy, sel.specialEnergy)])
    if (x.s.stadium !== null) options.push(x.s.stadium)
    const [pick] = yield* chooseCards(x, { title: 'Discard a Tool, a Special Energy, or the Stadium', options })
    if (pick === undefined) return
    if (pick === x.s.stadium) yield* discardStadium(x)
    else yield* discardAttached(x, [pick])
  },
} })

// Brilliant Blender: Search your deck for up to 5 cards and discard them. Then, shuffle your deck.
defineCard('SSP-164', { trainer: { *play(x) {
  const picks = yield* searchDeck(x, { filter: sel.any, max: 5, title: 'Discard up to 5 cards' })
  moveCards(x, picks, 'discard')
  shuffleDeck(x, x.me)
} } })

// Buddy-Buddy Poffin: Search your deck for up to 2 Basic Pokémon with 70 HP or less and put them onto your Bench.
defineCard('TEF-144', { trainer: {
  canPlay: x => x.s.players[x.me].bench.length < sel.benchRoom(x, x.me),
  *play(x) { yield* searchToBench(x, { filter: sel.and(sel.basicPokemon, sel.hpAtMost(70)), max: 2, title: 'Choose up to 2 Basic Pokémon with 70 HP or less' }) },
} })

// Bug Catching Set: Look at the top 7 cards of your deck. You may reveal up to 2 in any combination
// of {G} Pokémon and Basic {G} Energy cards… Shuffle the other cards back into your deck.
defineCard('TWM-143', { trainer: { *play(x) {
  yield* lookAndTake(x, topCards(x, 7), sel.or(sel.ofType('Grass'), sel.basicEnergy('Grass')), 2, 'Take up to 2 {G} Pokémon and Basic {G} Energy')
} } })

// Crushing Hammer: Flip a coin. If heads, discard an Energy from 1 of your opponent's Pokémon.
defineCard('POR-71', { trainer: { *play(x) {
  if (!flip(x)) return
  const [uid] = yield* chooseCards(x, { title: 'Discard an Energy from 1 of your opponent\'s Pokémon', options: inPlayOf(x, x.opp).flatMap(s => s.energy) })
  if (uid !== undefined) yield* discardAttached(x, [uid])
} } })

// Dusk Ball: Look at the bottom 7 cards of your deck. You may reveal a Pokémon you find there and
// put it into your hand. Shuffle the other cards back into your deck.
defineCard('SSP-175', { trainer: { *play(x) {
  yield* lookAndTake(x, bottomCards(x, 7), sel.pokemon, 1, 'Take a Pokémon')
} } })

// Energy Recycler: Shuffle up to 5 Basic Energy cards from your discard pile into your deck.
defineCard('DRI-164', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.basicEnergy()).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.basicEnergy(), max: 5, min: 1, title: 'Shuffle up to 5 Basic Energy into your deck', to: 'deck' }) },
} })

// Energy Retrieval: Put up to 2 Basic Energy cards from your discard pile into your hand.
defineCard('SVI-171', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.basicEnergy()).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.basicEnergy(), max: 2, min: 1, title: 'Choose up to 2 Basic Energy' }) },
} })

// Energy Search: Search your deck for a Basic Energy card…
defineCard('POR-72', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.basicEnergy(), title: 'Choose a Basic Energy' }) } } })

// Energy Switch: Move a Basic Energy from 1 of your Pokémon to another of your Pokémon.
defineCard('MEG-115', { trainer: {
  canPlay: x => inPlayOf(x, x.me).length > 1 && inPlayOf(x, x.me).some(s => matching(x, s.energy, sel.basicEnergy()).length),
  *play(x) {
    const options = inPlayOf(x, x.me).flatMap(s => matching(x, s.energy, sel.basicEnergy()))
    const [uid] = yield* chooseCards(x, { title: 'Choose a Basic Energy to move', options })
    if (uid === undefined) return
    const from = inPlayOf(x, x.me).find(s => s.energy.includes(uid))!
    const [to] = yield* choosePokemon(x, { title: `Move ${nameOf(x, uid)} to…`, options: inPlayOf(x, x.me).filter(s => s.id !== from.id) })
    if (to) moveEnergy(x, uid, to)
  },
} })

// Enhanced Hammer: Discard a Special Energy from 1 of your opponent's Pokémon.
defineCard('TWM-148', { trainer: {
  canPlay: x => inPlayOf(x, x.opp).some(s => matching(x, s.energy, sel.specialEnergy).length),
  *play(x) {
    const [uid] = yield* chooseCards(x, { title: 'Discard a Special Energy', options: inPlayOf(x, x.opp).flatMap(s => matching(x, s.energy, sel.specialEnergy)) })
    if (uid !== undefined) yield* discardAttached(x, [uid])
  },
} })

// Fighting Gong: Search your deck for a Basic {F} Energy card or a Basic {F} Pokémon…
defineCard('MEG-116', { trainer: { *play(x) {
  yield* searchToHand(x, { filter: sel.or(sel.basicEnergy('Fighting'), sel.and(sel.basicPokemon, sel.ofType('Fighting'))), title: 'Choose a Basic {F} Energy or Basic {F} Pokémon' })
} } })

// Glass Trumpet: only if you have any Tera Pokémon in play. Choose up to 2 of your Benched {C}
// Pokémon and attach a Basic Energy card from your discard pile to each of them.
defineCard('SCR-135', { trainer: {
  canPlay: x => inPlayOf(x, x.me, sel.tera).length > 0,
  *play(x) {
    const targets = yield* choosePokemon(x, { title: 'Choose up to 2 of your Benched {C} Pokémon', options: bench(x, x.me, sel.ofType('Colorless')), min: 0, max: 2 })
    for (const slot of targets) {
      const [uid] = yield* chooseCards(x, { title: `Basic Energy for ${sel.card(x, slot).name}`, options: matching(x, x.s.players[x.me].discard, sel.basicEnergy()) })
      if (uid !== undefined) yield* attachEnergy(x, uid, slot)
    }
  },
} })

// Hand Trimmer: Each player discards cards from their hand until they have 5. Your opponent discards first.
defineCard('TEF-150', { trainer: { *play(x) {
  for (const p of [x.opp, x.me]) {
    const n = x.s.players[p].hand.length - 5
    if (n > 0) yield* discardFromHand(x, { player: p, min: n, max: n, title: `Discard ${n} cards` })
  }
} } })

// Iron Defender: During your opponent's next turn, all of your {M} Pokémon take 30 less damage from
// attacks from your opponent's Pokémon (after applying Weakness and Resistance).
const ironDefender = defineMarker('ironDefender', { modifiers: {
  damageTaken: (src, ctx, ev) => (sel.ownerOfSlot(ctx, ev.target) === src.player && sel.ownerOfSlot(ctx, ev.attacker) !== src.player && is(ctx, ev.target, sel.ofType('Metal')) ? 30 : 0),
} })
defineCard('MEG-118', { trainer: { *play(x) { addMarker(x, ironDefender, { until: 'opponentsNextTurn' }) } } })

// Jumbo Ice Cream: Heal 80 damage from your Active Pokémon that has 3 or more Energy attached.
defineCard('PFL-91', { trainer: {
  canPlay: x => { const a = active(x, x.me); return !!a && a.energy.length >= 3 && a.damage > 0 },
  *play(x) { heal(x, active(x, x.me)!, 80) },
} })

// Max Rod: Put up to 5 in any combination of Pokémon and Basic Energy cards from your discard pile into your hand.
defineCard('PRE-116', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.or(sel.pokemon, sel.basicEnergy())).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.or(sel.pokemon, sel.basicEnergy()), max: 5, min: 1, title: 'Choose up to 5 Pokémon and Basic Energy' }) },
} })

// Mega Signal: Search your deck for a Mega Evolution Pokémon ex…
defineCard('MEG-121', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.and(sel.mega, sel.ex), title: 'Choose a Mega Evolution Pokémon ex' }) } } })

// Miracle Headset: Put up to 2 Supporter cards from your discard pile into your hand.
defineCard('SSP-183', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.trainerOf('Supporter')).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.trainerOf('Supporter'), max: 2, min: 1, title: 'Choose up to 2 Supporters' }) },
} })

// N's PP Up: Attach a Basic Energy card from your discard pile to 1 of your Benched N's Pokémon.
defineCard('JTG-153', { trainer: {
  canPlay: x => bench(x, x.me, sel.tagged("N's")).length > 0 && matching(x, x.s.players[x.me].discard, sel.basicEnergy()).length > 0,
  *play(x) {
    const [uid] = yield* chooseCards(x, { title: 'Choose a Basic Energy', options: matching(x, x.s.players[x.me].discard, sel.basicEnergy()) })
    const [slot] = yield* choosePokemon(x, { title: "Attach it to 1 of your Benched N's Pokémon", options: bench(x, x.me, sel.tagged("N's")) })
    if (uid !== undefined && slot) yield* attachEnergy(x, uid, slot)
  },
} })

// Night Stretcher: Put a Pokémon or a Basic Energy card from your discard pile into your hand.
defineCard('ASC-196', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.or(sel.pokemon, sel.basicEnergy())).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.or(sel.pokemon, sel.basicEnergy()), max: 1, min: 1, title: 'Choose a Pokémon or Basic Energy' }) },
} })

// Poké Pad: Search your deck for a Pokémon that doesn't have a Rule Box…
defineCard('POR-81', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.noRuleBox, title: 'Choose a Pokémon without a Rule Box' }) } } })

// Pokégear 3.0: Look at the top 7 cards. You may reveal a Supporter card you find there and put it
// into your hand. Shuffle the other cards back into your deck.
defineCard('SVI-186', { trainer: { *play(x) {
  yield* lookAndTake(x, topCards(x, 7), sel.trainerOf('Supporter'), 1, 'Take a Supporter')
} } })

// Pokémon Catcher: Flip a coin. If heads, switch in 1 of your opponent's Benched Pokémon to the Active Spot.
defineCard('POR-82', { trainer: {
  canPlay: x => bench(x, x.opp).length > 0,
  *play(x) { if (flip(x)) yield* gust(x) },
} })

// Precious Trolley: Search your deck for any number of Basic Pokémon and put them onto your Bench.
defineCard('SSP-185', { trainer: {
  canPlay: x => x.s.players[x.me].bench.length < sel.benchRoom(x, x.me),
  *play(x) { yield* searchToBench(x, { filter: sel.basicPokemon, max: 8, title: 'Choose any number of Basic Pokémon' }) },
} })

// Premium Power Pro: During this turn, attacks used by your {F} Pokémon do 30 more damage to your
// opponent's Active Pokémon (before applying Weakness and Resistance).
const powerPro = defineMarker('premiumPowerPro', { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && sel.ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, sel.ofType('Fighting')) ? 30 : 0),
} })
defineCard('MEG-124', { trainer: { *play(x) { addMarker(x, powerPro, { until: 'thisTurn' }) } } })

// Prime Catcher: Switch in 1 of your opponent's Benched Pokémon to the Active Spot. If you do,
// switch your Active Pokémon with 1 of your Benched Pokémon.
defineCard('TEF-157', { trainer: {
  canPlay: x => bench(x, x.opp).length > 0,
  *play(x) { if ((yield* gust(x)) && bench(x, x.me).length) yield* switchOwn(x) },
} })

// Rare Candy: Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that
// evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1.
// You can't use this card during your first turn or on a Basic Pokémon that was put into play this turn.
function candyPairs(x: X): [NonNullable<X['self']>, number][] {
  const out: [NonNullable<X['self']>, number][] = []
  for (const slot of inPlayOf(x, x.me, sel.basicPokemon)) {
    if (slot.enteredTurn >= x.s.turn || slot.evolvedTurn >= x.s.turn) continue
    const basic = sel.card(x, slot).name
    for (const uid of matching(x, x.s.players[x.me].hand, sel.stage('Stage 2'))) {
      const stage1 = x.db.card(x.s.cards[uid].cardId).evolveFrom
      if (stage1 && cardsNamed(stage1).some(c => c.evolveFrom === basic)) out.push([slot, uid])
    }
  }
  return out
}
defineCard('MEG-125', { trainer: {
  canPlay: x => !isFirstTurn(x, x.me) && candyPairs(x).length > 0,
  *play(x) {
    const pairs = candyPairs(x)
    const [slot] = yield* choosePokemon(x, { title: 'Choose 1 of your Basic Pokémon', options: [...new Map(pairs.map(([s]) => [s.id, s])).values()] })
    if (!slot) return
    const [uid] = yield* chooseCards(x, { title: 'Choose the Stage 2 card', options: pairs.filter(([s]) => s.id === slot.id).map(([, u]) => u) })
    if (uid !== undefined) yield* evolveWith(x, slot, uid)
  },
} })

// Redeemable Ticket: Count your Prize cards, shuffle them, and put them on the bottom of your deck.
// Then, take that many cards from the top of your deck and put them face down as your Prize cards.
defineCard('JTG-156', { trainer: { *play(x) {
  const pl = x.s.players[x.me]
  const prizes = pl.prizes.splice(0)
  const n = prizes.length
  shuffleInPlace(x.s, prizes)
  pl.deck.push(...prizes)
  pl.prizes = pl.deck.splice(0, Math.min(n, pl.deck.length))
  log(x, x.me, `Replaces their ${n} Prize cards.`)
} } })

// Roto-Stick: Look at the top 4 cards. You may reveal any number of Supporter cards you find there
// and put them into your hand. Shuffle the other cards back into your deck.
defineCard('PRE-127', { trainer: { *play(x) {
  yield* lookAndTake(x, topCards(x, 4), sel.trainerOf('Supporter'), 4, 'Take any number of Supporters')
} } })

// Sacred Ash: Shuffle up to 5 Pokémon from your discard pile into your deck.
defineCard('DRI-168', { trainer: {
  canPlay: x => matching(x, x.s.players[x.me].discard, sel.pokemon).length > 0,
  *play(x) { yield* fromDiscard(x, { filter: sel.pokemon, max: 5, min: 1, title: 'Shuffle up to 5 Pokémon into your deck', to: 'deck' }) },
} })

// Scoop Up Cyclone: Put 1 of your Pokémon and all attached cards into your hand.
defineCard('TWM-162', { trainer: { *play(x) {
  const [slot] = yield* choosePokemon(x, { title: 'Put 1 of your Pokémon into your hand', options: inPlayOf(x, x.me) })
  if (slot) yield* removePokemon(x, slot, 'hand')
} } })

// Secret Box: only if you discard 3 other cards from your hand. Search your deck for an Item card,
// a Pokémon Tool card, a Supporter card, and a Stadium card…
defineCard('TWM-163', { trainer: {
  canPlay: x => handOthers(x) >= 3,
  *play(x) {
    yield* discardFromHand(x, { min: 3, max: 3, title: 'Discard 3 cards' })
    yield* searchEach(x, [
      [sel.trainerOf('Item'), 'Choose an Item'], [sel.trainerOf('Tool'), 'Choose a Pokémon Tool'],
      [sel.trainerOf('Supporter'), 'Choose a Supporter'], [sel.trainerOf('Stadium'), 'Choose a Stadium'],
    ])
  },
} })

// Special Red Card: only if your opponent has 3 or fewer Prize cards remaining. Your opponent
// shuffles their hand and puts it on the bottom of their deck. If they put any cards there, they draw 3.
defineCard('CRI-82', { trainer: {
  canPlay: x => prizesLeft(x, x.opp) <= 3,
  *play(x) { if (handToDeckBottom(x, x.opp)) draw(x, 3, x.opp) },
} })

// Strange Timepiece: Devolve 1 of your evolved {P} Pokémon by putting any number of Evolution cards
// on it into your hand. (That Pokémon can't evolve this turn.)
defineCard('MEG-128', { trainer: {
  canPlay: x => inPlayOf(x, x.me, sel.ofType('Psychic')).some(s => s.stack.length > 1),
  *play(x) {
    const [slot] = yield* choosePokemon(x, { title: 'Devolve 1 of your evolved {P} Pokémon', options: inPlayOf(x, x.me, sel.ofType('Psychic')).filter(s => s.stack.length > 1) })
    if (!slot) return
    const options = slot.stack.slice(1).map((_, i) => `${i + 1} Evolution card${i ? 's' : ''}`)
    const n = 1 + (yield* chooseOption(x, 'How many Evolution cards?', options))
    devolve(x, slot, n)
    log(x, x.me, `Devolves ${sel.card(x, slot).name}.`)
  },
} })

// Switch: Switch your Active Pokémon with 1 of your Benched Pokémon.
defineCard('MEG-130', { trainer: { canPlay: x => bench(x, x.me).length > 0, *play(x) { yield* switchOwn(x) } } })

// Tasty Rice Ball: Heal 30 damage from your Active Pokémon. For each Tasty Rice Ball card (not
// including this card) in your discard pile, heal 30 more damage.
defineCard('DLR-101', { trainer: {
  canPlay: x => (active(x, x.me)?.damage ?? 0) > 0,
  *play(x) {
    const more = matching(x, x.s.players[x.me].discard, sel.named('Tasty Rice Ball')).length
    heal(x, active(x, x.me)!, 30 + 30 * more)
  },
} })

// Team Rocket's Transceiver: Search your deck for a Supporter card that has "Team Rocket" in its name…
defineCard('DRI-178', { trainer: { *play(x) {
  yield* searchToHand(x, { filter: sel.and(sel.trainerOf('Supporter'), sel.nameHas('Team Rocket')), title: 'Choose a Team Rocket Supporter' })
} } })

// Tool Scrapper: Choose up to 2 Pokémon Tools attached to Pokémon (yours or your opponent's) and discard them.
defineCard('ASC-212', { trainer: {
  canPlay: x => sel.bothInPlay(x).some(s => s.tools.length),
  *play(x) {
    const picks = yield* chooseCards(x, { title: 'Discard up to 2 Pokémon Tools', options: sel.bothInPlay(x).flatMap(s => s.tools), min: 1, max: 2 })
    yield* discardAttached(x, picks)
  },
} })

// Ultra Ball: only if you discard 2 other cards from your hand. Search your deck for a Pokémon…
defineCard('MEG-131', { trainer: {
  canPlay: x => handOthers(x) >= 2,
  *play(x) {
    yield* discardFromHand(x, { min: 2, max: 2, title: 'Discard 2 cards' })
    yield* searchToHand(x, { filter: sel.pokemon, title: 'Choose a Pokémon' })
  },
} })

// Unfair Stamp: only if any of your Pokémon were Knocked Out during your opponent's last turn. Each
// player shuffles their hand into their deck. Then, you draw 5 cards, and your opponent draws 2.
defineCard('TWM-165', { trainer: {
  canPlay: x => sel.knockedOutLastTurn(x, x.me),
  *play(x) {
    shuffleHandIntoDeck(x, x.me)
    shuffleHandIntoDeck(x, x.opp)
    draw(x, 5, x.me)
    draw(x, 2, x.opp)
  },
} })

// Wondrous Patch: Attach a Basic {P} Energy card from your discard pile to 1 of your Benched {P} Pokémon.
defineCard('PFL-94', { trainer: {
  canPlay: x => bench(x, x.me, sel.ofType('Psychic')).length > 0 && matching(x, x.s.players[x.me].discard, sel.basicEnergy('Psychic')).length > 0,
  *play(x) {
    const [uid] = yield* chooseCards(x, { title: 'Choose a Basic {P} Energy', options: matching(x, x.s.players[x.me].discard, sel.basicEnergy('Psychic')) })
    const [slot] = yield* choosePokemon(x, { title: 'Attach it to 1 of your Benched {P} Pokémon', options: bench(x, x.me, sel.ofType('Psychic')) })
    if (uid !== undefined && slot) yield* attachEnergy(x, uid, slot)
  },
} })

