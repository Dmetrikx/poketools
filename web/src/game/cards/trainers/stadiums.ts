// Stadiums in the card pool, each written from its catalog text.

import {
  choosePokemon, defineCard, discardFromHand, discardPokemon, draw, endTheTurn, evolveWith, heal, isFirstTurn,
  moveCards, chooseCards, placeCounters, searchDeck, searchToBench, searchToHand, sel,
  shuffleDeck, switchOwn, thisTurn, type X,
} from '../fx'

const { is, inPlayOf, bench, active } = sel

// Academy at Night: Once during each player's turn, that player may put a card from their hand on top of their deck.
defineCard('SFA-54', { trainer: { action: {
  canUse: x => x.s.players[x.me].hand.length > 0,
  *run(x) {
    const [uid] = yield* chooseCards(x, { title: 'Put a card from your hand on top of your deck', options: x.s.players[x.me].hand })
    if (uid !== undefined) moveCards(x, [uid], 'deckTop')
  },
} } })

// Area Zero Underdepths: Each player who has any Tera Pokémon in play can have up to 8 Pokémon on
// their Bench. If a player no longer has any Tera Pokémon in play, that player discards Pokémon from
// their Bench until they have 5. When this card leaves play, both players discard Pokémon from their
// Bench until they have 5, and the player who played this card discards first.
function* cutBench(x: X, p: X['me']) {
  const pl = x.s.players[p]
  const n = pl.bench.length - 5
  if (n <= 0) return
  const picks = yield* choosePokemon(x, { title: `Discard ${n} Benched Pokémon`, options: pl.bench, min: n, max: n, player: p })
  for (const slot of picks) discardPokemon(x, slot)
}
defineCard('SCR-131', { trainer: {
  modifiers: { benchSize: (_src, ctx, p) => (inPlayOf(ctx, p, sel.tera).length ? 8 : undefined) },
  on: { *leftPlay(x, ev) {
    if (ev.card !== x.card) return
    yield* cutBench(x, x.me)
    yield* cutBench(x, x.opp)
  } },
} })

// Battle Cage: Prevent all damage counters from being placed on Benched Pokémon (both yours and your
// opponent's) by effects of attacks and Abilities from the opponent's Pokémon.
defineCard('PFL-85', { trainer: { modifiers: {
  preventEffect: (_src, ctx, r) => r.what === 'counters' && (r.from === 'attack' || r.from === 'ability') &&
    !sel.isActive(ctx, r.target) && sel.ownerOfSlot(ctx, r.target) !== r.by,
} } })

// Community Center: Once during each player's turn, if they played a Supporter card from their hand
// this turn, they may heal 10 damage from each of their Pokémon.
defineCard('TWM-146', { trainer: { action: {
  canUse: x => thisTurn(x).supporters.length > 0,
  *run(x) { for (const s of inPlayOf(x, x.me)) heal(x, s, 10) },
} } })

// Festival Grounds: Each Pokémon that has any Energy attached (both yours and your opponent's)
// recovers from all Special Conditions and can't be affected by any Special Conditions.
defineCard('TWM-149', { trainer: { modifiers: { canHaveCondition: (_src, _c, slot) => slot.energy.length === 0 } } })

// Forest of Vitality: Each player's {G} Pokémon can evolve into {G} Pokémon during the turn they play
// those Pokémon, except during their first turn.
defineCard('MEG-117', { trainer: { modifiers: {
  evolveSameTurn: (_src, ctx, slot, uid) => is(ctx, slot, sel.ofType('Grass')) && sel.ofType('Grass')(ctx.db.card(ctx.s.cards[uid].cardId)),
} } })

// Grand Tree: Once during each player's turn, that player may search their deck for a Stage 1
// Pokémon that evolves from 1 of their Basic Pokémon and put it onto that Pokémon to evolve it. If
// that Pokémon was evolved in this way, that player may search their deck for a Stage 2 Pokémon
// that evolves from that Pokémon and evolve it. Then, that player shuffles their deck. (Players can't
// evolve a Basic Pokémon during their first turn or a Basic Pokémon that was put into play this turn.)
const grandTreeBasics = (x: X) => inPlayOf(x, x.me, sel.basicPokemon).filter(s => s.enteredTurn < x.s.turn && s.evolvedTurn < x.s.turn)
defineCard('SCR-136', { trainer: { action: {
  canUse: x => !isFirstTurn(x, x.me) && grandTreeBasics(x).length > 0,
  *run(x) {
    const names = new Set(grandTreeBasics(x).map(s => sel.card(x, s).name))
    const [stage1] = yield* searchDeck(x, { filter: c => sel.stage('Stage 1')(c) && names.has(c.evolveFrom ?? ''), title: 'Choose a Stage 1 Pokémon' })
    if (stage1 !== undefined) {
      const from = x.db.card(x.s.cards[stage1].cardId).evolveFrom
      const [slot] = yield* choosePokemon(x, { title: `Evolve which ${from}?`, options: grandTreeBasics(x).filter(s => sel.card(x, s).name === from) })
      if (slot) {
        yield* evolveWith(x, slot, stage1)
        const name = sel.card(x, slot).name
        const [stage2] = yield* searchDeck(x, { filter: c => sel.stage('Stage 2')(c) && c.evolveFrom === name, title: 'You may choose a Stage 2 Pokémon' })
        if (stage2 !== undefined) yield* evolveWith(x, slot, stage2)
      }
    }
    shuffleDeck(x, x.me)
  },
} } })

// Gravity Mountain: Each Stage 2 Pokémon in play (both yours and your opponent's) gets -30 HP.
defineCard('SSP-177', { trainer: { modifiers: { hp: (_src, ctx, slot) => (is(ctx, slot, sel.stage('Stage 2')) ? -30 : 0) } } })

// Jamming Tower: Pokémon Tools attached to each Pokémon (both yours and your opponent's) have no effect.
defineCard('TWM-153', { trainer: { modifiers: { noTools: () => true } } })

// Legendary Pyroduct: Evolution Pokémon in play (both yours and your opponent's) have no Abilities.
defineCard('DLR-94', { trainer: { modifiers: { noAbilities: (_src, ctx, slot) => is(ctx, slot, sel.evolutionPokemon) } } })

// Lumiose City: Once during each player's turn, that player may search their deck for a Basic
// Pokémon and put it onto their Bench. Then, that player shuffles their deck. If a player searches
// their deck in this way, their turn ends.
defineCard('POR-77', { trainer: { action: {
  canUse: x => x.s.players[x.me].bench.length < sel.benchRoom(x, x.me),
  *run(x) {
    yield* searchToBench(x, { filter: sel.basicPokemon, max: 1, title: 'Choose a Basic Pokémon' })
    endTheTurn(x)
  },
} } })

// N's Castle: N's Pokémon in play (both yours and your opponent's) have no Retreat Cost.
defineCard('JTG-152', { trainer: { modifiers: { retreatCost: (_src, ctx, slot) => (is(ctx, slot, sel.tagged("N's")) ? 'none' : 0) } } })

// Nighttime Mine: Attacks used by each Tera Pokémon in play (both yours and your opponent's) cost {C} more.
defineCard('ASC-197', { trainer: { modifiers: {
  attackCost: (_src, ctx, slot, _a, cost) => (is(ctx, slot, sel.tera) ? [...cost, 'Colorless'] : cost),
} } })

// Prism Tower: Once during each player's turn, that player may discard 2 cards from their hand in order to draw a card.
defineCard('CRI-80', { trainer: { action: {
  canUse: x => x.s.players[x.me].hand.length >= 2,
  *run(x) {
    yield* discardFromHand(x, { min: 2, max: 2, title: 'Discard 2 cards' })
    draw(x, 1)
  },
} } })

// Risky Ruins: Whenever any player puts a Basic non-{D} Pokémon onto their Bench during their turn,
// place 2 damage counters on that Pokémon.
defineCard('MEG-127', { trainer: { on: { playedToBench(x, ev) {
  if (ev.player !== x.s.turnPlayer) return
  const c = sel.card(x, ev.slot)
  if (sel.basicPokemon(c) && !sel.ofType('Darkness')(c)) placeCounters({ ...x, me: x.s.turnPlayer }, ev.slot, 2)
} } } })

// Spikemuth Gym: Once during each player's turn, that player may search their deck for a Marnie's
// Pokémon, reveal it, and put it into their hand. Then, that player shuffles their deck.
defineCard('DRI-169', { trainer: { action: {
  *run(x) { yield* searchToHand(x, { filter: sel.tagged("Marnie's"), title: "Choose a Marnie's Pokémon" }) },
} } })

// Surfing Beach: Once during each player's turn, that player may switch their Active {W} Pokémon with 1 of their Benched {W} Pokémon.
defineCard('MEG-129', { trainer: { action: {
  canUse: x => { const a = active(x, x.me); return !!a && is(x, a, sel.ofType('Water')) && bench(x, x.me, sel.ofType('Water')).length > 0 },
  *run(x) { yield* switchOwn(x, bench(x, x.me, sel.ofType('Water'))) },
} } })

// Team Rocket's Factory: Once during each player's turn, if they played a Supporter card that has
// "Team Rocket" in its name from their hand this turn, they may draw 2 cards.
defineCard('DRI-173', { trainer: { action: {
  canUse: x => thisTurn(x).supporters.some(n => n.includes('Team Rocket')),
  *run(x) { draw(x, 2) },
} } })

// Team Rocket's Watchtower: {C} Pokémon in play (both yours and your opponent's) have no Abilities.
defineCard('DRI-180', { trainer: { modifiers: { noAbilities: (_src, ctx, slot) => is(ctx, slot, sel.ofType('Colorless')) } } })


// ── Standard events after LAIC (5+ lists) ────────────────────────────────

// Postwick: Attacks used by Hop's Pokémon (both yours and your opponent's) do 30 more damage to the
// opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('JTG-154', { trainer: { modifiers: {
  damageDealt: (_src, ctx, ev) => (ev.toActive && is(ctx, ev.attacker, sel.tagged("Hop's")) ? 30 : 0),
} } })
