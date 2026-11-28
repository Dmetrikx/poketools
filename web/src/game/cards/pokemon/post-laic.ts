// Pokémon that entered the pool from the Standard events after LAIC 2026-27
// (played in 5+ lists), each written from its catalog text.

import {
  addMarker, attachEnergy, chooseCards, choosePokemon, damage, damageActive, defineCard,
  defineMarker, discardAllEnergy, discardEnergy, discardFromHand, draw, flip, flips, gust, heal, knockOut, log,
  matching, maxHp, may, moveCards, moveEnergy, nameOf, placeCounters, reaches, searchDeck, searchToBench, sel,
  selfDamage, shuffleDeck, thisTurn, type AttackX, type Ctx, type Source,
} from '../fx'
import { abilityOff } from '../../engine/modifiers'
import { SHIELDED, cantAttackNextTurn, cantUseNextTurn, copyFromSlots, defenderCantRetreat, hitPlus, hitTimes } from './common'

const { active, bench, energyCount, inPlayOf, is, isActive, ownerOfSlot, prizesLeft } = sel

/** "The effect of [ability] doesn't stack": only the first such Pokémon of its owner counts. */
function firstWith(ctx: Ctx, src: Source, cardId: string, ability: string): boolean {
  const first = inPlayOf(ctx, src.player).find(s => sel.card(ctx, s).id === cardId && !abilityOff(ctx, s, ability))
  return !!first && first.id === src.slot?.id
}

function* benchHit(a: AttackX, n: number) {
  const [t] = yield* choosePokemon(a, { title: `Do ${n} damage to 1 of your opponent's Benched Pokémon`, options: bench(a, a.opp) })
  if (t) damage(a, t, n)
}

const shieldSelf = (a: AttackX) => addMarker(a, SHIELDED, { until: 'opponentsNextTurn', slot: a.attacker })

// Applin (DRI) — Mini Drain: Heal 10 damage from this Pokémon.
defineCard('DRI-16', { attacks: { *'Mini Drain'(a) { damageActive(a, a.base); heal(a, a.attacker, 10) } } })

// Bloodmoon Ursaluna (PRE) — Battle-Hardened: When you play this Pokémon from your hand onto your
// Bench during your turn, you may attach up to 2 Basic {F} Energy cards from your hand to this
// Pokémon. Mad Bite: This attack does 30 more damage for each damage counter on your opponent's
// Active Pokémon.
defineCard('PRE-54', {
  abilities: { 'Battle-Hardened': { on: { *playedToBench(x, ev) {
    const self = x.self
    if (!self || ev.slot.id !== self.id || !ev.fromHand) return
    const options = matching(x, x.s.players[x.me].hand, sel.basicEnergy('Fighting'))
    if (!options.length || !(yield* may(x, 'Use Battle-Hardened?'))) return
    const picks = yield* chooseCards(x, { title: 'Attach up to 2 Basic {F} Energy to this Pokémon', options, min: 0, max: 2 })
    for (const uid of picks) yield* attachEnergy(x, uid, self)
  } } } },
  attacks: { *'Mad Bite'(a) { const d = active(a, a.opp); hitPlus(a, d ? 30 * sel.counters(d) : 0) } },
})

// Bouffalant (SCR) — Curly Wall: As long as you have at least 1 other Bouffalant in play, all of your
// Basic {C} Pokémon take 60 less damage from attacks from your opponent's Pokémon (after applying
// Weakness and Resistance). The effect of Curly Wall doesn't stack. Boundless Power: During your next
// turn, this Pokémon can't attack.
defineCard('SCR-119', {
  abilities: { 'Curly Wall': { modifiers: {
    damageTaken: (src, ctx, ev) => {
      if (ownerOfSlot(ctx, ev.target) !== src.player || ownerOfSlot(ctx, ev.attacker) === src.player) return 0
      if (!is(ctx, ev.target, sel.and(sel.basicPokemon, sel.ofType('Colorless')))) return 0
      const others = inPlayOf(ctx, src.player, sel.named('Bouffalant')).filter(s => s.id !== src.slot?.id)
      return others.length && firstWith(ctx, src, 'SCR-119', 'Curly Wall') ? 60 : 0
    },
  } } },
  attacks: { *'Boundless Power'(a) { damageActive(a, a.base); cantAttackNextTurn(a) } },
})

// Bouffalant (SSP) — Ready to Ram: During your opponent's next turn, if this Pokémon is damaged by an
// attack (even if this Pokémon is Knocked Out), put 6 damage counters on the Attacking Pokémon.
// Smashing Headbutt: Discard 2 Energy from this Pokémon.
const READY_TO_RAM = defineMarker('readyToRam', { on: { damagedByAttack(x, ev) {
  if (x.self && ev.target.id === x.self.id && ownerOfSlot(x, ev.attacker) !== x.me) placeCounters(x, ev.attacker, 6)
} } })
defineCard('SSP-151', { attacks: {
  *'Ready to Ram'(a) { damageActive(a, a.base); addMarker(a, READY_TO_RAM, { until: 'opponentsNextTurn', slot: a.attacker }) },
  *'Smashing Headbutt'(a) { damageActive(a, a.base); yield* discardEnergy(a, a.attacker, { n: Math.min(2, a.attacker.energy.length) }) },
} })

// Bronzong (TEF) — Evolution Jammer: During your opponent's next turn, they can't play any Pokémon
// from their hand to evolve their Pokémon.
const EVOLUTION_JAMMER = defineMarker('evolutionJammer', { modifiers: {
  canPlay: (src, ctx, p, uid) => {
    const c = ctx.db.card(ctx.s.cards[uid].cardId)
    return !(p !== src.player && c.kind === 'pokemon' && c.subtype !== 'Basic')
  },
} })
defineCard('TEF-69', { attacks: { *'Evolution Jammer'(a) {
  damageActive(a, a.base)
  addMarker(a, EVOLUTION_JAMMER, { until: 'opponentsNextTurn' })
} } })

// Bronzor (TEF) — Mirror Attack: If your opponent's Active Pokémon is a {P} Pokémon, this attack does 30 more damage.
defineCard('TEF-68', { attacks: { *'Mirror Attack'(a) {
  const d = active(a, a.opp)
  hitPlus(a, d && is(a, d, sel.ofType('Psychic')) ? 30 : 0)
} } })

// Ceruledge ex (SSP) — Abyssal Flames: This attack does 20 more damage for each Energy card in your
// discard pile. Raging Amethyst: Discard all Energy from this Pokémon.
defineCard('SSP-36', { attacks: {
  *'Abyssal Flames'(a) { hitPlus(a, 20 * matching(a, a.s.players[a.me].discard, sel.energyCard).length) },
  *'Raging Amethyst'(a) { damageActive(a, a.base); yield* discardAllEnergy(a, a.attacker) },
} })

// Chandelure (TWM) — Alluring Light: Once during your turn, you may have each player draw a card.
// Mind Ruler: This attack does 30 damage for each card in your opponent's hand.
defineCard('TWM-38', {
  abilities: { 'Alluring Light': { *use(x) { draw(x, 1, x.me); draw(x, 1, x.opp) } } },
  attacks: { *'Mind Ruler'(a) { hitTimes(a, a.s.players[a.opp].hand.length) } },
})

// Drilbur (TEF) — Dig Dig Dig: When you play this Pokémon from your hand onto your Bench during your
// turn, you may search your deck for up to 3 Basic {F} Energy cards and discard them. Then, shuffle your deck.
defineCard('TEF-85', { abilities: { 'Dig Dig Dig': { on: { *playedToBench(x, ev) {
  if (ev.slot.id !== x.self?.id || !ev.fromHand || !(yield* may(x, 'Use Dig Dig Dig?'))) return
  const picks = yield* searchDeck(x, { filter: sel.basicEnergy('Fighting'), max: 3, title: 'Discard up to 3 Basic {F} Energy' })
  moveCards(x, picks, 'discard')
  if (picks.length) log(x, x.me, `Discards ${picks.length} Basic {F} Energy from their deck.`)
  shuffleDeck(x, x.me)
} } } } })

// Elgyem (BLK) — Slight Shift: Move an Energy from 1 of your opponent's Pokémon to another of their Pokémon.
defineCard('BLK-40', { attacks: { *'Slight Shift'(a) {
  const theirs = inPlayOf(a, a.opp)
  if (theirs.length < 2) return
  const [uid] = yield* chooseCards(a, { title: 'Move an Energy from 1 of your opponent\'s Pokémon', options: theirs.filter(s => reaches(a, s)).flatMap(s => s.energy) })
  if (uid === undefined) return
  const from = theirs.find(s => s.energy.includes(uid))!
  const [to] = yield* choosePokemon(a, { title: `Move ${nameOf(a, uid)} to…`, options: theirs.filter(s => s.id !== from.id && reaches(a, s)) })
  if (to) moveEnergy(a, uid, to)
} } })

// Hop's Cramorant (JTG) — Fickle Spitting: If your opponent doesn't have exactly 3 or 4 Prize cards
// remaining, this attack does nothing.
defineCard('JTG-138', { attacks: { *'Fickle Spitting'(a) {
  const left = prizesLeft(a, a.opp)
  if (left === 3 || left === 4) damageActive(a, a.base)
} } })

// Hop's Dubwool (JTG) — Defiant Horn: When you play this Pokémon from your hand to evolve 1 of your
// Pokémon during your turn, you may switch in 1 of your opponent's Benched Pokémon to the Active Spot.
defineCard('JTG-136', { abilities: { 'Defiant Horn': { on: { *evolved(x, ev) {
  if (ev.slot.id !== x.self?.id || !ev.fromHand || !bench(x, x.opp).length || !(yield* may(x, 'Use Defiant Horn?'))) return
  yield* gust(x)
} } } } })

// Hop's Phantump (ASC) — Splashing Dodge: Flip a coin. If heads, during your opponent's next turn,
// prevent all damage from and effects of attacks done to this Pokémon.
defineCard('ASC-95', { attacks: { *'Splashing Dodge'(a) { damageActive(a, a.base); if (flip(a)) shieldSelf(a) } } })

// Hop's Snorlax (JTG) — Extra Helpings: Attacks used by your Hop's Pokémon do 30 more damage to your
// opponent's Active Pokémon (before applying Weakness and Resistance). The effect of Extra Helpings
// doesn't stack. Dynamic Press: This Pokémon also does 80 damage to itself.
defineCard('JTG-117', {
  abilities: { 'Extra Helpings': { modifiers: {
    damageDealt: (src, ctx, ev) => (ev.toActive && ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, sel.tagged("Hop's")) &&
      firstWith(ctx, src, 'JTG-117', 'Extra Helpings') ? 30 : 0),
  } } },
  attacks: { *'Dynamic Press'(a) { damageActive(a, a.base); selfDamage(a, 80) } },
})

// Hop's Trevenant (ASC) — Horrifying Revenge: If any of your Hop's Pokémon were Knocked Out by damage
// from an attack during your opponent's last turn, this attack does 100 more damage. Corner: During
// your opponent's next turn, the Defending Pokémon can't retreat.
defineCard('ASC-96', { attacks: {
  *'Horrifying Revenge'(a) { hitPlus(a, sel.knockedOutLastTurn(a, a.me, { byAttack: true, filter: sel.tagged("Hop's") }) ? 100 : 0) },
  *Corner(a) { damageActive(a, a.base); defenderCantRetreat(a) },
} })

// Hop's Zacian ex (JTG) — Insta-Strike: This attack also does 30 damage to 1 of your opponent's
// Benched Pokémon. Brave Slash: During your next turn, this Pokémon can't use Brave Slash.
defineCard('JTG-111', { attacks: {
  *'Insta-Strike'(a) { damageActive(a, a.base); yield* benchHit(a, 30) },
  *'Brave Slash'(a) { damageActive(a, a.base); cantUseNextTurn(a) },
} })

// Jellicent ex (WHT) — Oceanic Curse: As long as this Pokémon is in the Active Spot, your opponent
// can't play any Item cards or Pokémon Tool cards from their hand. Power Press: If this Pokémon has at
// least 2 extra Energy attached (in addition to this attack's cost), this attack does 80 more damage.
defineCard('WHT-45', {
  abilities: { 'Oceanic Curse': { modifiers: {
    canPlay: (src, ctx, p, uid) => {
      if (p === src.player || !src.slot || !isActive(ctx, src.slot)) return true
      const c = ctx.db.card(ctx.s.cards[uid].cardId)
      return !(c.kind === 'trainer' && (c.subtype === 'Item' || c.subtype === 'Tool'))
    },
  } } },
  attacks: { *'Power Press'(a) { hitPlus(a, energyCount(a, a.attacker) >= a.attack.cost.length + 2 ? 80 : 0) } },
})

// Lampent (PBL) — Spreading Light: Search your deck for up to 3 Lampent and put them onto your Bench.
// Then, shuffle your deck.
defineCard('PBL-37', { attacks: { *'Spreading Light'(a) {
  yield* searchToBench(a, { filter: sel.named('Lampent'), max: 3, title: 'Put up to 3 Lampent onto your Bench' })
} } })

// Maractus (JTG) — Exploding Needles: If this Pokémon is in the Active Spot and is Knocked Out by
// damage from an attack from your opponent's Pokémon, put 6 damage counters on the Attacking Pokémon.
// Corner: During your opponent's next turn, the Defending Pokémon can't retreat.
defineCard('JTG-8', {
  abilities: { 'Exploding Needles': { on: { damagedByAttack(x, ev) {
    const self = x.self
    if (!self || ev.target.id !== self.id || !isActive(x, self) || ownerOfSlot(x, ev.attacker) === x.me) return
    if (self.damage >= maxHp(x, self)) placeCounters(x, ev.attacker, 6)
  } } } },
  attacks: { *Corner(a) { damageActive(a, a.base); defenderCantRetreat(a) } },
})

// Mega Absol ex (MEG) — Terminal Period: If your opponent's Active Pokémon has exactly 6 damage
// counters on it, that Pokémon is Knocked Out. Claw of Darkness: Your opponent reveals their hand,
// and you discard a card you find there.
defineCard('MEG-86', { attacks: {
  *'Terminal Period'(a) {
    const d = active(a, a.opp)
    if (d && sel.counters(d) === 6 && reaches(a, d)) knockOut(a, d)
  },
  *'Claw of Darkness'(a) {
    damageActive(a, a.base)
    const hand = a.s.players[a.opp].hand
    log(a, a.opp, `Reveals their hand: ${hand.map(u => nameOf(a, u)).join(', ') || 'empty'}.`)
    yield* discardFromHand(a, { player: a.opp, chooser: a.me, min: Math.min(1, hand.length), max: 1, title: 'Discard a card from your opponent\'s hand' })
  },
} })

// Relicanth (TEF) — Memory Dive: Each of your evolved Pokémon can use any attack from its previous
// Evolutions. (You still need the necessary Energy to use each attack.)
defineCard('TEF-84', { abilities: { 'Memory Dive': { modifiers: {
  extraAttacks: (src, ctx, slot) => {
    if (ownerOfSlot(ctx, slot) !== src.player || slot.stack.length < 2) return []
    return slot.stack.slice(0, -1).flatMap(uid => {
      const c = ctx.db.card(ctx.s.cards[uid].cardId)
      return (c.attacks ?? []).map(at => ({ cardId: c.id, attack: at.name }))
    })
  },
} } } })

// Slowpoke (PBL) — All-You-Can-Yeet: You may discard any number of cards from your hand.
defineCard('PBL-29', { attacks: { *'All-You-Can-Yeet'(a) {
  const n = a.s.players[a.me].hand.length
  if (n) yield* discardFromHand(a, { min: 0, max: n, title: 'Discard any number of cards' })
} } })

// Smoochum (SSP) — Delightful Kiss: Search your deck for up to 2 Basic {P} Energy cards and attach
// them to 1 of your Benched Pokémon. Then, shuffle your deck.
defineCard('SSP-75', { attacks: { *'Delightful Kiss'(a) {
  const [slot] = yield* choosePokemon(a, { title: 'Attach to 1 of your Benched Pokémon', options: bench(a, a.me) })
  if (slot) {
    const picks = yield* searchDeck(a, { filter: sel.basicEnergy('Psychic'), max: 2, title: 'Choose up to 2 Basic {P} Energy' })
    for (const uid of picks) yield* attachEnergy(a, uid, slot)
  }
  shuffleDeck(a, a.me)
} } })

// Spectrier (ASC) — Phantasmal Barrage: Discard all Energy from this Pokémon and place 12 damage
// counters on 1 of your opponent's Pokémon.
defineCard('ASC-98', { attacks: { *'Phantasmal Barrage'(a) {
  yield* discardAllEnergy(a, a.attacker)
  const [t] = yield* choosePokemon(a, { title: 'Place 12 damage counters on 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
  if (t) placeCounters(a, t, 12)
} } })

// Stunfisk (ASC) — Pouncing Trap: During your opponent's next turn, the Defending Pokémon can't
// retreat. During your next turn, the Defending Pokémon takes 100 more damage from attacks (after
// applying Weakness and Resistance).
const POUNCED = defineMarker('pouncingTrap', { modifiers: {
  damageTaken: (src, ctx, ev) => (ev.target.id === src.marker!.slot && ctx.s.turnPlayer === src.player &&
    ctx.s.turn > Number(src.marker!.data!.turn) && ownerOfSlot(ctx, ev.attacker) === src.player ? -100 : 0),
} })
defineCard('ASC-62', { attacks: { *'Pouncing Trap'(a) {
  damageActive(a, a.base)
  defenderCantRetreat(a)
  if (a.defender && reaches(a, a.defender)) addMarker(a, POUNCED, { until: 'myNextTurn', slot: a.defender, sticky: true, data: { turn: a.s.turn } })
} } })

// Team Rocket's Kangaskhan ex (ASC) — Comet Punch: Flip 4 coins. This attack does 30 damage for each
// heads. Wicked Impact: If you played a Supporter card that has "Team Rocket" in its name from your
// hand during this turn, this attack does 100 more damage.
defineCard('ASC-162', { attacks: {
  *'Comet Punch'(a) { hitTimes(a, flips(a, 4)) },
  *'Wicked Impact'(a) { hitPlus(a, thisTurn(a).supporters.some(n => n.includes('Team Rocket')) ? 100 : 0) },
} })

// Trumbeak (PBL) — Fly: Flip a coin. If tails, this attack does nothing. If heads, during your
// opponent's next turn, prevent all damage from and effects of attacks done to this Pokémon.
defineCard('PBL-67', { attacks: { *Fly(a) {
  if (!flip(a)) return
  damageActive(a, a.base)
  shieldSelf(a)
} } })

// Zoroark (WHT) — Mind Jack: This attack does 30 damage for each of your opponent's Benched Pokémon.
// Foul Play: Choose 1 of your opponent's Active Pokémon's attacks and use it as this attack.
defineCard('WHT-62', { attacks: {
  *'Mind Jack'(a) { hitTimes(a, bench(a, a.opp).length) },
  *'Foul Play'(a) { const d = active(a, a.opp); if (d) yield* copyFromSlots(a, [d], 'Choose 1 of your opponent\'s Active Pokémon\'s attacks') },
} })
