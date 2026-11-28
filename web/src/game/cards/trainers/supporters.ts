// Supporters in the card pool, each written from its catalog text.

import {
  addMarker, applyCondition, chooseOption, choosePokemon, defineCard, defineMarker, discardAttached,
  discardFromHand, discardHand, draw, drawUntil, flip, gust, handToDeckBottom, heal, log,
  matching, moveCards, moveEnergy, nameOf, removeConditions, searchDeck, searchToHand, sel,
  shuffleDeck, shuffleHandIntoDeck, switchOwn, topCards, chooseCards, attachEnergy, evolveWith, maxHp,
  orderCards, type X,
} from '../fx'
import { fromDiscard, searchEach } from '../helpers'

const { active, bench, inPlayOf, is, isActive, prizesLeft } = sel
const top = (x: X, uid: number) => x.db.card(x.s.cards[uid].cardId)

// Aarune: Search your deck for up to 3 in any combination of Supporter and Stadium cards…
defineCard('DLR-89', { trainer: { *play(x) {
  yield* searchToHand(x, { filter: sel.or(sel.trainerOf('Supporter'), sel.trainerOf('Stadium')), max: 3, title: 'Choose up to 3 Supporter and Stadium cards' })
} } })

// Acerola's Mischief: only if your opponent has 2 or fewer Prize cards remaining. During your
// opponent's next turn, prevent all damage from and effects of attacks done to the chosen Pokémon
// by your opponent's Pokémon ex.
const acerola = defineMarker('acerolaMischief', { modifiers: {
  preventDamage: (src, ctx, ev) => ev.target.id === src.marker!.slot && sel.ex(sel.card(ctx, ev.attacker)) && sel.ownerOfSlot(ctx, ev.attacker) !== src.player,
  preventEffect: (src, ctx, r) => r.target.id === src.marker!.slot && r.from === 'attack' && r.by !== src.player &&
    !!active(ctx, r.by) && sel.ex(sel.card(ctx, active(ctx, r.by)!)),
} })
defineCard('MEG-113', { trainer: {
  canPlay: x => prizesLeft(x, x.opp) <= 2,
  *play(x) {
    const [slot] = yield* choosePokemon(x, { title: 'Choose 1 of your Pokémon', options: inPlayOf(x, x.me) })
    if (slot) addMarker(x, acerola, { until: 'opponentsNextTurn', slot, sticky: true })
  },
} })

// AZ's Tranquility: Switch your Active with 1 of your Benched Pokémon. If you moved a Pokémon ex
// to your Bench in this way, heal 80 damage from that Pokémon.
defineCard('CRI-76', { trainer: {
  canPlay: x => bench(x, x.me).length > 0,
  *play(x) {
    const old = active(x, x.me)
    if ((yield* switchOwn(x)) && old && is(x, old, sel.ex)) heal(x, old, 80)
  },
} })

// Bianca's Devotion: Heal all damage from 1 of your Pokémon that has 30 HP or less remaining.
const lowHp = (x: X) => inPlayOf(x, x.me).filter(s => s.damage > 0 && maxHp(x, s) - s.damage <= 30)
defineCard('TEF-142', { trainer: {
  canPlay: x => lowHp(x).length > 0,
  *play(x) {
    const [slot] = yield* choosePokemon(x, { title: 'Heal all damage from 1 of your Pokémon', options: lowHp(x) })
    if (slot) heal(x, slot, slot.damage)
  },
} })

// Black Belt's Training: During this turn, attacks used by your Pokémon do 40 more damage to your
// opponent's Active Pokémon ex (before applying Weakness and Resistance).
const blackBelt = defineMarker('blackBelt', { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && sel.ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.target, sel.ex) ? 40 : 0),
} })
defineCard('JTG-143', { trainer: { *play(x) { addMarker(x, blackBelt, { until: 'thisTurn' }) } } })

// Boss's Orders: Switch in 1 of your opponent's Benched Pokémon to the Active Spot.
defineCard('MEG-114', { trainer: { canPlay: x => bench(x, x.opp).length > 0, *play(x) { yield* gust(x) } } })

// Briar: only if your opponent has exactly 2 Prize cards remaining. During this turn, if your
// opponent's Active Pokémon is Knocked Out by damage from an attack used by your Tera Pokémon,
// take 1 more Prize card.
const briar = defineMarker('briar', { modifiers: {
  prizes: (src, ctx, ko) => (ko.byAttack && ko.wasActive && ko.owner !== src.player && ko.attackerOwner === src.player &&
    !!ko.attacker && is(ctx, ko.attacker, sel.tera) ? 1 : 0),
} })
defineCard('SCR-132', { trainer: { canPlay: x => prizesLeft(x, x.opp) === 2, *play(x) { addMarker(x, briar, { until: 'thisTurn' }) } } })

// Brock's Scouting: Search your deck for up to 2 Basic Pokémon or 1 Evolution Pokémon…
defineCard('JTG-146', { trainer: { *play(x) {
  const which = yield* chooseOption(x, 'Search for…', ['Up to 2 Basic Pokémon', '1 Evolution Pokémon'])
  yield* searchToHand(x, which === 0
    ? { filter: sel.basicPokemon, max: 2, title: 'Choose up to 2 Basic Pokémon' }
    : { filter: sel.evolutionPokemon, max: 1, title: 'Choose an Evolution Pokémon' })
} } })

// Carmine: If you go first, you may use this card during your first turn. Discard your hand and draw 5 cards.
defineCard('TWM-145', { trainer: { firstTurn: true, *play(x) { discardHand(x); draw(x, 5) } } })

// Ciphermaniac's Codebreaking: Search your deck for 2 cards, shuffle your deck, then put those
// cards on top of it in any order.
defineCard('TEF-145', { trainer: { *play(x) {
  const picks = yield* searchDeck(x, { filter: sel.any, max: 2, title: 'Choose 2 cards' })
  moveCards(x, picks, 'hand')
  shuffleDeck(x, x.me)
  const order = yield* orderCards(x, 'Order them, top card first', picks)
  moveCards(x, [...order].reverse(), 'deckTop')
  log(x, x.me, `Puts ${picks.length} card${picks.length === 1 ? '' : 's'} on top of their deck.`)
} } })

// Colress's Tenacity: Search your deck for a Stadium card and an Energy card…
defineCard('SFA-57', { trainer: { *play(x) {
  yield* searchEach(x, [[sel.trainerOf('Stadium'), 'Choose a Stadium card'], [sel.energyCard, 'Choose an Energy card']])
} } })

// Crispin: Search your deck for up to 2 Basic Energy cards of different types, reveal them, and
// put 1 of them into your hand. Attach the other to 1 of your Pokémon. Then, shuffle your deck.
defineCard('SCR-133', { trainer: { *play(x) {
  const [first] = yield* searchDeck(x, { filter: sel.basicEnergy(), max: 1, title: 'Choose a Basic Energy' })
  const picks = first === undefined ? [] : [first]
  if (first !== undefined) {
    const t = top(x, first).energyType
    const [second] = yield* searchDeck(x, { filter: c => sel.basicEnergy()(c) && c.energyType !== t, max: 1, title: 'Choose a Basic Energy of another type' })
    if (second !== undefined) picks.push(second)
  }
  if (picks.length === 2) {
    const [toHand] = yield* chooseCards(x, { title: 'Put 1 into your hand (the other is attached)', options: picks })
    moveCards(x, [toHand], 'hand')
    const other = picks.find(p => p !== toHand)!
    const [slot] = yield* choosePokemon(x, { title: `Attach ${nameOf(x, other)} to 1 of your Pokémon`, options: inPlayOf(x, x.me) })
    if (slot) yield* attachEnergy(x, other, slot)
  } else if (picks.length === 1) {
    moveCards(x, picks, 'hand')
  }
  shuffleDeck(x, x.me)
} } })

// Cyrano: Search your deck for up to 3 Pokémon ex…
defineCard('SSP-170', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.ex, max: 3, title: 'Choose up to 3 Pokémon ex' }) } } })

// Dawn: Search your deck for a Basic Pokémon, a Stage 1 Pokémon, and a Stage 2 Pokémon…
defineCard('PFL-87', { trainer: { *play(x) {
  yield* searchEach(x, [
    [sel.stage('Basic'), 'Choose a Basic Pokémon'], [sel.stage('Stage 1'), 'Choose a Stage 1 Pokémon'], [sel.stage('Stage 2'), 'Choose a Stage 2 Pokémon'],
  ])
} } })

// Eri: Your opponent reveals their hand, and you discard up to 2 Item cards you find there.
defineCard('TEF-146', { trainer: { *play(x) {
  log(x, x.opp, `Reveals their hand: ${x.s.players[x.opp].hand.map(u => nameOf(x, u)).join(', ') || 'empty'}.`)
  yield* discardFromHand(x, { player: x.opp, chooser: x.me, filter: sel.trainerOf('Item'), min: 0, max: 2, title: 'Discard up to 2 Item cards' })
} } })

// Ethan's Adventure: Search your deck for up to 3 in any combination of Ethan's Pokémon and Basic {R} Energy cards…
defineCard('DRI-165', { trainer: { *play(x) {
  yield* searchToHand(x, { filter: sel.or(sel.tagged("Ethan's"), sel.basicEnergy('Fire')), max: 3, title: "Choose up to 3 Ethan's Pokémon and Basic {R} Energy" })
} } })

// Explorer's Guidance: Look at the top 6 cards of your deck and put 2 of them into your hand. Discard the other cards.
defineCard('TEF-147', { trainer: { *play(x) {
  const looked = topCards(x, 6)
  const picks = yield* chooseCards(x, { title: 'Put 2 into your hand', options: looked, min: 2, max: 2 })
  moveCards(x, picks, 'hand')
  moveCards(x, looked.filter(u => !picks.includes(u)), 'discard')
  log(x, x.me, `Puts 2 cards into their hand and discards ${looked.length - picks.length}.`)
} } })

// Firebreather: Search your deck for up to 7 Basic {R} Energy cards…
defineCard('PFL-89', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.basicEnergy('Fire'), max: 7, title: 'Choose up to 7 Basic {R} Energy' }) } } })

// Gladion's Final Battle: only when it is the last card in your hand. During this turn, attacks
// used by your Pokémon that don't have a Rule Box do 80 more damage to your opponent's Active Pokémon.
const gladion = defineMarker('gladionFinalBattle', { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && sel.ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, sel.noRuleBox) ? 80 : 0),
} })
defineCard('PBL-77', { trainer: {
  canPlay: x => x.s.players[x.me].hand.every(u => u === x.card),
  *play(x) { addMarker(x, gladion, { until: 'thisTurn' }) },
} })

// Grisham: Heal 50 damage from each Pokémon (both yours and your opponent's).
defineCard('DLR-93', { trainer: { *play(x) { for (const s of sel.bothInPlay(x)) heal(x, s, 50) } } })

// Gwynn: Discard up to 2 Pokémon that don't have a Rule Box from your hand, and draw 3 cards for each card you discarded.
defineCard('PBL-78', { trainer: { *play(x) {
  const n = (yield* discardFromHand(x, { filter: sel.noRuleBox, min: 0, max: 2, title: 'Discard up to 2 Pokémon without a Rule Box' })).length
  if (n) draw(x, 3 * n)
} } })

// Harlequin: Each player shuffles their hand into their deck. Then, flip a coin. If heads, you draw
// 5 cards and your opponent draws 3. If tails, you draw 3 and your opponent draws 5.
defineCard('WHT-83', { trainer: { *play(x) {
  shuffleHandIntoDeck(x, x.me)
  shuffleHandIntoDeck(x, x.opp)
  const heads = flip(x)
  draw(x, heads ? 5 : 3, x.me)
  draw(x, heads ? 3 : 5, x.opp)
} } })

// Hilda: Search your deck for an Evolution Pokémon and an Energy card…
defineCard('WHT-84', { trainer: { *play(x) {
  yield* searchEach(x, [[sel.evolutionPokemon, 'Choose an Evolution Pokémon'], [sel.energyCard, 'Choose an Energy card']])
} } })

// Iris's Fighting Spirit: only if you discard another card from your hand. Draw until you have 6 cards.
defineCard('JTG-149', { trainer: {
  canPlay: x => x.s.players[x.me].hand.some(u => u !== x.card),
  *play(x) {
    yield* discardFromHand(x, { min: 1, max: 1, title: 'Discard a card' })
    drawUntil(x, 6)
  },
} })

// Janine's Secret Art: Choose up to 2 of your {D} Pokémon. For each, search your deck for a Basic
// {D} Energy card and attach it. Then, shuffle. If you attached Energy to your Active Pokémon in
// this way, it is now Poisoned.
defineCard('PRE-112', { trainer: { *play(x) {
  const targets = yield* choosePokemon(x, { title: 'Choose up to 2 of your {D} Pokémon', options: inPlayOf(x, x.me, sel.ofType('Darkness')), min: 0, max: 2 })
  let poisonActive = false
  for (const slot of targets) {
    const [uid] = yield* searchDeck(x, { filter: sel.basicEnergy('Darkness'), title: `Basic {D} Energy for ${sel.card(x, slot).name}` })
    if (uid === undefined) continue
    yield* attachEnergy(x, uid, slot)
    if (isActive(x, slot)) poisonActive = true
  }
  shuffleDeck(x, x.me)
  const a = active(x, x.me)
  if (poisonActive && a) applyCondition(x, a, 'poisoned')
} } })

// Judge: Each player shuffles their hand into their deck and draws 4 cards.
defineCard('POR-76', { trainer: { *play(x) {
  for (const p of [x.me, x.opp]) shuffleHandIntoDeck(x, p)
  for (const p of [x.me, x.opp]) draw(x, 4, p)
} } })

// Kieran: Choose 1: switch your Active with 1 of your Benched Pokémon; or during this turn, your
// attacks do 30 more damage to your opponent's Active Pokémon ex and Active Pokémon V.
const kieran = defineMarker('kieran', { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && sel.ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.target, sel.ex) ? 30 : 0),
} })
defineCard('TWM-154', { trainer: { *play(x) {
  const options = ['Your attacks do 30 more to the opponent\'s Active Pokémon ex this turn']
  if (bench(x, x.me).length) options.unshift('Switch your Active Pokémon')
  const i = yield* chooseOption(x, 'Kieran: choose 1', options)
  if (options[i].startsWith('Switch')) yield* switchOwn(x)
  else addMarker(x, kieran, { until: 'thisTurn' })
} } })

// Lana's Aid: Put up to 3 in any combination of Pokémon that don't have a Rule Box and Basic
// Energy cards from your discard pile into your hand.
defineCard('TWM-155', { trainer: { *play(x) {
  yield* fromDiscard(x, { filter: sel.or(sel.noRuleBox, sel.basicEnergy()), max: 3, title: 'Choose up to 3 Pokémon without a Rule Box and Basic Energy' })
} } })

// Lillie's Determination: Shuffle your hand into your deck. Then, draw 6 cards. If you have
// exactly 6 Prize cards remaining, draw 8 cards instead.
defineCard('MEG-119', { trainer: { *play(x) {
  shuffleHandIntoDeck(x, x.me)
  draw(x, prizesLeft(x, x.me) === 6 ? 8 : 6)
} } })

// Lisia's Appeal: Switch in 1 of your opponent's Benched Basic Pokémon to the Active Spot. If you
// do, the new Active Pokémon is now Confused.
defineCard('SSP-179', { trainer: {
  canPlay: x => bench(x, x.opp, sel.basicPokemon).length > 0,
  *play(x) {
    const slot = yield* gust(x, bench(x, x.opp, sel.basicPokemon))
    if (slot) applyCondition(x, slot, 'confused')
  },
} })

// Lucian: Each player shuffles their hand and puts it on the bottom of their deck. If either
// player put any cards there, each player flips a coin. If heads, that player draws 6. If tails, 3.
defineCard('TWM-157', { trainer: { *play(x) {
  const n = handToDeckBottom(x, x.me) + handToDeckBottom(x, x.opp)
  if (!n) return
  for (const p of [x.me, x.opp]) draw(x, flip({ ...x, me: p }) ? 6 : 3, p)
} } })

// N's Plan: Move up to 2 Energy from your Benched Pokémon to your Active Pokémon.
defineCard('BLK-83', { trainer: {
  canPlay: x => bench(x, x.me).some(b => b.energy.length > 0),
  *play(x) {
    const a = active(x, x.me)!
    const options = bench(x, x.me).flatMap(b => b.energy)
    const picks = yield* chooseCards(x, { title: 'Move up to 2 Energy to your Active Pokémon', options, min: 0, max: 2 })
    for (const uid of picks) moveEnergy(x, uid, a)
  },
} })

// Naveen: Draw cards until you have 5 cards in your hand. Before drawing cards, you may discard
// any number of cards from your hand. (If you can't draw any cards in this way, you can't use this card.)
defineCard('POR-79', { trainer: {
  canPlay: x => x.s.players[x.me].deck.length > 0,
  *play(x) {
    yield* discardFromHand(x, { min: 0, max: x.s.players[x.me].hand.length, title: 'Discard any number of cards first' })
    drawUntil(x, 5)
  },
} })

// Pokémon Center Lady: Heal 60 damage from 1 of your Pokémon, and it recovers from all Special Conditions.
defineCard('MEG-123', { trainer: { *play(x) {
  const [slot] = yield* choosePokemon(x, { title: 'Heal 1 of your Pokémon', options: inPlayOf(x, x.me) })
  if (!slot) return
  heal(x, slot, 60)
  if (slot.rotation || slot.poisoned || slot.burned) removeConditions(x, slot)
} } })

// Rosa's Encouragement: only if you have more Prize cards remaining than your opponent. Attach up
// to 2 Basic Energy cards from your discard pile to 1 of your Stage 2 Pokémon.
defineCard('POR-84', { trainer: {
  canPlay: x => prizesLeft(x, x.me) > prizesLeft(x, x.opp),
  *play(x) {
    const [slot] = yield* choosePokemon(x, { title: 'Choose 1 of your Stage 2 Pokémon', options: inPlayOf(x, x.me, sel.stage('Stage 2')) })
    if (!slot) return
    const picks = yield* chooseCards(x, { title: 'Attach up to 2 Basic Energy', options: matching(x, x.s.players[x.me].discard, sel.basicEnergy()), min: 0, max: 2 })
    for (const uid of picks) yield* attachEnergy(x, uid, slot)
  },
} })

// Ruffian: Discard a Pokémon Tool and a Special Energy from 1 of your opponent's Pokémon.
defineCard('JTG-157', { trainer: { *play(x) {
  const options = inPlayOf(x, x.opp).filter(s => s.tools.length || matching(x, s.energy, sel.specialEnergy).length)
  const [slot] = yield* choosePokemon(x, { title: 'Choose 1 of your opponent\'s Pokémon', options })
  if (!slot) return
  const tools = yield* chooseCards(x, { title: 'Discard a Pokémon Tool', options: slot.tools })
  const energy = yield* chooseCards(x, { title: 'Discard a Special Energy', options: matching(x, slot.energy, sel.specialEnergy) })
  yield* discardAttached(x, [...tools, ...energy])
} } })

// Salvatore: Search your deck for a card that has no Abilities and evolves from 1 of your Pokémon,
// and put it onto that Pokémon to evolve it. Then, shuffle. You can use this card on a Pokémon you
// put down when you were setting up to play or on a Pokémon that was put into play this turn.
defineCard('TEF-160', { trainer: { *play(x) {
  const mine = inPlayOf(x, x.me).filter(s => s.evolvedTurn < x.s.turn)
  const names = new Set(mine.map(s => sel.card(x, s).name))
  const [uid] = yield* searchDeck(x, { filter: c => sel.noAbilities(c) && c.kind === 'pokemon' && !!c.evolveFrom && names.has(c.evolveFrom), title: 'Choose an evolution with no Abilities' })
  if (uid !== undefined) {
    const from = top(x, uid).evolveFrom
    const [slot] = yield* choosePokemon(x, { title: `Evolve which ${from}?`, options: mine.filter(s => sel.card(x, s).name === from) })
    if (slot) yield* evolveWith(x, slot, uid)
  }
  shuffleDeck(x, x.me)
} } })

// Surfer: Switch your Active Pokémon with 1 of your Benched Pokémon. If you do, draw cards until you have 5.
defineCard('SSP-187', { trainer: {
  canPlay: x => bench(x, x.me).length > 0,
  *play(x) { if (yield* switchOwn(x)) drawUntil(x, 5) },
} })

// Team Rocket's Archer: only if any of your Team Rocket's Pokémon were Knocked Out during your
// opponent's last turn. Each player shuffles their hand into their deck. Then you draw 5, your opponent 3.
defineCard('DRI-170', { trainer: {
  canPlay: x => sel.knockedOutLastTurn(x, x.me, { filter: sel.tagged("Team Rocket's") }),
  *play(x) {
    shuffleHandIntoDeck(x, x.me)
    shuffleHandIntoDeck(x, x.opp)
    draw(x, 5, x.me)
    draw(x, 3, x.opp)
  },
} })

// Team Rocket's Ariana: Draw until you have 5 cards. If all of your Pokémon in play are Team
// Rocket's Pokémon, draw until you have 8 instead.
defineCard('DRI-171', { trainer: { *play(x) {
  const all = inPlayOf(x, x.me).every(s => is(x, s, sel.tagged("Team Rocket's")))
  drawUntil(x, all ? 8 : 5)
} } })

// Team Rocket's Giovanni: Switch your Active Team Rocket's Pokémon with 1 of your Benched Team
// Rocket's Pokémon. If you do, switch in 1 of your opponent's Benched Pokémon to the Active Spot.
defineCard('DRI-174', { trainer: {
  canPlay: x => {
    const a = active(x, x.me)
    return !!a && is(x, a, sel.tagged("Team Rocket's")) && bench(x, x.me, sel.tagged("Team Rocket's")).length > 0
  },
  *play(x) {
    if ((yield* switchOwn(x, bench(x, x.me, sel.tagged("Team Rocket's")))) && bench(x, x.opp).length) yield* gust(x)
  },
} })

// Team Rocket's Petrel: Search your deck for a Trainer card…
defineCard('DRI-176', { trainer: { *play(x) { yield* searchToHand(x, { filter: sel.trainer, title: 'Choose a Trainer card' }) } } })

// Team Rocket's Proton: If you go first, you may use this card during your first turn. Search your
// deck for up to 3 Basic Team Rocket's Pokémon…
defineCard('DRI-177', { trainer: { firstTurn: true, *play(x) {
  yield* searchToHand(x, { filter: sel.and(sel.basicPokemon, sel.tagged("Team Rocket's")), max: 3, title: "Choose up to 3 Basic Team Rocket's Pokémon" })
} } })

// Wally's Compassion: Heal all damage from 1 of your Mega Evolution Pokémon ex. If you healed any
// damage in this way, put all Energy attached to that Pokémon into your hand.
defineCard('MEG-132', { trainer: { *play(x) {
  const [slot] = yield* choosePokemon(x, { title: 'Choose 1 of your Mega Evolution Pokémon ex', options: inPlayOf(x, x.me, sel.and(sel.mega, sel.ex)) })
  if (slot && heal(x, slot, slot.damage) > 0) moveCards(x, [...slot.energy], 'hand')
} } })

// Xerosic's Machinations: Your opponent discards cards from their hand until they have 3 cards in their hand.
defineCard('SFA-64', { trainer: { *play(x) {
  const n = x.s.players[x.opp].hand.length - 3
  if (n > 0) yield* discardFromHand(x, { player: x.opp, min: n, max: n, title: `Discard ${n} cards` })
} } })

// Zinnia's Trust: Switch your Active Pokémon with 1 of your Benched Pokémon. If you do, move an
// Energy from the Pokémon you moved to your Bench to the new Active Pokémon.
defineCard('DLR-103', { trainer: {
  canPlay: x => bench(x, x.me).length > 0,
  *play(x) {
    const old = active(x, x.me)
    const now = yield* switchOwn(x)
    if (!now || !old || !old.energy.length) return
    const [uid] = yield* chooseCards(x, { title: 'Move an Energy to the new Active Pokémon', options: old.energy })
    if (uid !== undefined) moveEnergy(x, uid, now)
  },
} })


// ── Standard events after LAIC (5+ lists) ────────────────────────────────

// Hassel: You can use this card only if any of your Pokémon were Knocked Out during your opponent's
// last turn. Look at the top 8 cards of your deck and put up to 3 of them into your hand. Shuffle
// the other cards back into your deck.
defineCard('TWM-151', { trainer: {
  canPlay: x => sel.knockedOutLastTurn(x, x.me),
  *play(x) {
    const picks = yield* chooseCards(x, { title: 'Put up to 3 into your hand', options: topCards(x, 8), min: 0, max: 3 })
    moveCards(x, picks, 'hand')
    log(x, x.me, `Puts ${picks.length} card${picks.length === 1 ? '' : 's'} into their hand.`)
    shuffleDeck(x, x.me)
  },
} })

// Larry's Skill: Discard your hand and search your deck for a Pokémon, a Supporter card, and a Basic
// Energy card, reveal them, and put them into your hand. Then, shuffle your deck.
defineCard('PRE-115', { trainer: { *play(x) {
  discardHand(x)
  yield* searchEach(x, [[sel.pokemon, 'Choose a Pokémon'], [sel.trainerOf('Supporter'), 'Choose a Supporter card'], [sel.basicEnergy(), 'Choose a Basic Energy']])
} } })

// Morty's Conviction: You can use this card only if you discard another card from your hand. Draw a
// card for each of your opponent's Benched Pokémon.
defineCard('TEF-155', { trainer: {
  canPlay: x => x.s.players[x.me].hand.some(u => u !== x.card),
  *play(x) {
    yield* discardFromHand(x, { min: 1, max: 1, title: 'Discard a card' })
    draw(x, bench(x, x.opp).length)
  },
} })

// Rust Syndicate Grunt: You can use this card only if any of your Pokémon were Knocked Out during
// your opponent's last turn. Discard an Energy from 1 of your opponent's Pokémon.
defineCard('PBL-81', { trainer: {
  canPlay: x => sel.knockedOutLastTurn(x, x.me),
  *play(x) {
    const [uid] = yield* chooseCards(x, { title: 'Discard an Energy from 1 of your opponent\'s Pokémon', options: inPlayOf(x, x.opp).flatMap(s => s.energy) })
    if (uid !== undefined) yield* discardAttached(x, [uid])
  },
} })

// Tarragon: Put up to 4 in any combination of {F} Pokémon and Basic {F} Energy cards from your
// discard pile into your hand.
defineCard('POR-85', { trainer: { *play(x) {
  yield* fromDiscard(x, { filter: sel.or(sel.ofType('Fighting'), sel.basicEnergy('Fighting')), max: 4, title: 'Choose up to 4 {F} Pokémon and Basic {F} Energy' })
} } })
