// The remaining archetypes and singles: Cynthia's Garchomp, Ethan's Typhlosion, Dusknoir,
// Grimmsnarl / Froslass, Beedrill, Blaziken, Arboliva, and Pokémon outside the fixture lists.

import {
  addMarker, applyCondition, attachEnergy, chooseCards, chooseOption, choosePokemon, coin, damage, damageActive,
  defineCard, discardAllEnergy, discardAttached, discardStadium, distribute, distributeCounters, draw, drawUntil,
  energyAlternatives, flip, flips, heal, knockOut, log, matching, may, moveCards, moveCounters, moveEnergy, nameOf,
  placeCounters, putOntoBench, reaches, removeConditions, searchDeck, searchToHand, sel, selfDamage, shuffleDeck,
  switchActive, type AbilityImpl, type AttackX,
} from '../fx'
import { abilityImpl } from '../../engine/modifiers'
import {
  CROWN_OPAL, NO_ITEMS, SHIELDED, cantAttackNextTurn, defenderCantRetreat, hitPlus, hitTimes, takesLessNextTurn,
  usedLastTurn,
} from './common'

const { active, bench, energyCount, energyOn, hasWorkingAbility, inPlayOf, is, isActive, ownerOfSlot, prizesTaken } = sel

/** "This attack does N damage to 1 of your opponent's Benched Pokémon." */
function* benchHit(a: AttackX, n: number) {
  const [t] = yield* choosePokemon(a, { title: `Do ${n} damage to 1 of your opponent's Benched Pokémon`, options: bench(a, a.opp) })
  if (t) damage(a, t, n)
}

// ── Psychic and Darkness singles ─────────────────────────────────────────

// Alakazam (TWM) — Strange Hacking: Your opponent's Active Pokémon is now Confused. You may move any
// number of damage counters from your opponent's Pokémon to their other Pokémon in any way you like.
// Psychic: This attack does 50 more damage for each Energy attached to your opponent's Active Pokémon.
defineCard('TWM-82', { attacks: {
  *'Strange Hacking'(a) {
    const d = active(a, a.opp)
    if (d) applyCondition(a, d, 'confused')
    for (let i = 0; i < 30; i++) {
      const theirs = inPlayOf(a, a.opp)
      const damaged = theirs.filter(s => s.damage > 0)
      if (!damaged.length || theirs.length < 2 || !(yield* may(a, 'Move damage counters between your opponent\'s Pokémon?'))) return
      const [from] = yield* choosePokemon(a, { title: 'Move damage counters from…', options: damaged })
      const [to] = yield* choosePokemon(a, { title: '…to', options: theirs.filter(s => s.id !== from.id) })
      const n = 1 + (yield* chooseOption(a, 'How many?', Array.from({ length: from.damage / 10 }, (_, k) => String(k + 1))))
      if (!moveCounters(a, from, to, n)) return
    }
  },
  *Psychic(a) { const d = active(a, a.opp); hitPlus(a, d ? 50 * energyCount(a, d) : 0) },
} })

// Annihilape (PBL) — Durable Body: If this Pokémon would be Knocked Out by damage from an attack, flip
// a coin. If heads, it is not Knocked Out, and its remaining HP becomes 10. Ghostly Blow: Place 5
// damage counters on 1 of your opponent's Benched Pokémon.
defineCard('PBL-41', {
  abilities: { 'Durable Body': { modifiers: {
    survive: (src, ctx, ev) => {
      if (ev.target.id !== src.slot?.id) return false
      const heads = coin(ctx.s)
      log(ctx, src.player, `Durable Body: flip ${heads ? 'heads' : 'tails'}.`)
      return heads
    },
  } } },
  attacks: { *'Ghostly Blow'(a) {
    damageActive(a, a.base)
    const [t] = yield* choosePokemon(a, { title: 'Place 5 damage counters on 1 of your opponent\'s Benched Pokémon', options: bench(a, a.opp) })
    if (t) placeCounters(a, t, 5)
  } },
})

// Annihilape (SSP) — Tantrum: This Pokémon is now Confused. Destined Fight: Both Active Pokémon are Knocked Out.
defineCard('SSP-100', { attacks: {
  *Tantrum(a) { damageActive(a, a.base); applyCondition(a, a.attacker, 'confused') },
  *'Destined Fight'(a) {
    const d = active(a, a.opp)
    if (d && reaches(a, d)) knockOut(a, d)
    knockOut(a, a.attacker)
  },
} })

// Cofagrigus — Law of the Underworld: Put 6 damage counters on each Pokémon that has an Ability (both yours and your opponent's).
defineCard('SSP-83', { attacks: { *'Law of the Underworld'(a) {
  for (const s of sel.bothInPlay(a).filter(s => hasWorkingAbility(a, s))) placeCounters(a, s, 6)
} } })

// Dedenne — Electromagnetic Sonar: Put a Trainer card from your discard pile into your hand.
defineCard('SSP-87', { attacks: { *'Electromagnetic Sonar'(a) {
  const [uid] = yield* chooseCards(a, { title: 'Put a Trainer card into your hand', options: matching(a, a.s.players[a.me].discard, sel.trainer) })
  if (uid !== undefined) moveCards(a, [uid], 'hand')
} } })

// Drapion — Hazardous Tail: This Pokémon also does 70 damage to itself. Your opponent's Active Pokémon
// is now Paralyzed and Poisoned.
defineCard('POR-52', { attacks: { *'Hazardous Tail'(a) {
  damageActive(a, a.base)
  selfDamage(a, 70)
  const d = active(a, a.opp)
  if (d) { applyCondition(a, d, 'paralyzed'); applyCondition(a, d, 'poisoned') }
} } })

// Duskull — Come and Get You: Put up to 3 Duskull from your discard pile onto your Bench.
defineCard('PRE-35', { attacks: { *'Come and Get You'(a) {
  const room = sel.benchRoom(a, a.me) - a.s.players[a.me].bench.length
  const picks = yield* chooseCards(a, { title: 'Put up to 3 Duskull onto your Bench', options: matching(a, a.s.players[a.me].discard, sel.named('Duskull')), min: 0, max: Math.min(3, room) })
  for (const uid of picks) yield* putOntoBench(a, uid)
} } })

// Dusclops / Dusknoir — Cursed Blast: Once during your turn, you may put 5 / 13 damage counters on 1 of
// your opponent's Pokémon. If you use this Ability, this Pokémon is Knocked Out.
const cursedBlast = (n: number): AbilityImpl => ({
  selfKnockOut: true,
  *use(x) {
    const [t] = yield* choosePokemon(x, { title: `Put ${n} damage counters on 1 of your opponent's Pokémon`, options: inPlayOf(x, x.opp) })
    if (t) placeCounters(x, t, n)
    if (x.self) knockOut(x, x.self)
  },
})
defineCard('PRE-36', { abilities: { 'Cursed Blast': cursedBlast(5) } })
// Dusknoir — Shadow Bind: During your opponent's next turn, the Defending Pokémon can't retreat.
defineCard('PRE-37', {
  abilities: { 'Cursed Blast': cursedBlast(13) },
  attacks: { *'Shadow Bind'(a) { damageActive(a, a.base); defenderCantRetreat(a) } },
})

// Psyduck — Damp: Pokémon in play lose any Ability that requires the Pokémon using it to Knock Out itself.
defineCard('ASC-39', { abilities: { Damp: { modifiers: {
  noAbilities: (_src, ctx, slot, ability) => !!abilityImpl(ctx, sel.card(ctx, slot).id, ability)?.selfKnockOut,
} } } })

// Flutter Mane — Midnight Fluttering: As long as this Pokémon is in the Active Spot, your opponent's
// Active Pokémon has no Abilities, except for Midnight Fluttering. Hex Hurl: Put 2 damage counters on
// your opponent's Benched Pokémon in any way you like.
defineCard('TEF-78', {
  abilities: { 'Midnight Fluttering': { modifiers: {
    noAbilities: (src, ctx, slot, ability) => !!src.slot && isActive(ctx, src.slot) && isActive(ctx, slot) &&
      ownerOfSlot(ctx, slot) !== src.player && ability !== 'Midnight Fluttering',
  } } },
  attacks: { *'Hex Hurl'(a) {
    damageActive(a, a.base)
    yield* distributeCounters(a, 'Put 2 damage counters on your opponent\'s Benched Pokémon', bench(a, a.opp), 2)
  } },
})

// Frillish — Oceanic Gloom: During your opponent's next turn, they can't play any Item cards from their hand.
defineCard('WHT-44', { attacks: { *'Oceanic Gloom'(a) { damageActive(a, a.base); addMarker(a, NO_ITEMS, { until: 'opponentsNextTurn' }) } } })

// Giratina — Chaos Crawler: During your opponent's next turn, prevent all damage from attacks done to
// this Pokémon. If 1 of your Pokémon used Chaos Crawler during your last turn, this attack can't be used.
defineCard('DLR-45', { attacks: { 'Chaos Crawler': {
  canUse: a => !usedLastTurn(a, 'Chaos Crawler'),
  *run(a) {
    damageActive(a, a.base)
    addMarker(a, SHIELDED, { until: 'opponentsNextTurn', slot: a.attacker, data: { effects: false } })
  },
} } })

// N's Purrloin — Thieving Swipe: Your opponent reveals their hand, and you choose a card you find
// there and put it on the bottom of their deck.
defineCard('JTG-96', { attacks: { *'Thieving Swipe'(a) {
  damageActive(a, a.base)
  const hand = a.s.players[a.opp].hand
  log(a, a.opp, `Reveals their hand: ${hand.map(u => nameOf(a, u)).join(', ') || 'empty'}.`)
  const [uid] = yield* chooseCards(a, { title: 'Put a card on the bottom of their deck', options: hand })
  if (uid !== undefined) moveCards(a, [uid], 'deckBottom')
} } })

// N's Reshiram — Powerful Rage: This attack does 20 damage for each damage counter on this Pokémon.
defineCard('JTG-116', { attacks: { *'Powerful Rage'(a) { hitTimes(a, a.attacker.damage / 10) } } })

// Patrat — Watchful Eye: Damage counters on each Pokémon can't be moved to other Pokémon.
defineCard('CRI-70', { abilities: { 'Watchful Eye': { modifiers: { canMoveCounters: () => false } } } })

// Pecharunt (SVP) — Toxic Subjugation: As long as this Pokémon is in the Active Spot, put 5 more damage
// counters on your opponent's Poisoned Pokémon during Pokémon Checkup. Poison Chain: Your opponent's
// Active Pokémon is now Poisoned. During your opponent's next turn, that Pokémon can't retreat.
defineCard('SVP-149', {
  abilities: { 'Toxic Subjugation': { modifiers: {
    poisonCounters: (src, ctx, slot) => (!!src.slot && isActive(ctx, src.slot) && ownerOfSlot(ctx, slot) !== src.player ? 5 : 0),
  } } },
  attacks: { *'Poison Chain'(a) {
    damageActive(a, a.base)
    const d = active(a, a.opp)
    if (d) applyCondition(a, d, 'poisoned')
    defenderCantRetreat(a)
  } },
})

// Yveltal (30C) — Life-Locked: Your opponent's Active Pokémon can't be healed.
defineCard('30C-100', { abilities: { 'Life-Locked': { modifiers: {
  canHeal: (src, ctx, slot) => !(isActive(ctx, slot) && ownerOfSlot(ctx, slot) !== src.player),
} } } })

// Slowpoke (MEP) — Dopey Face: This Pokémon can't be Confused.
defineCard('MEP-86', { abilities: { 'Dopey Face': { modifiers: {
  canHaveCondition: (src, _c, slot, c) => !(src.slot?.id === slot.id && c === 'confused'),
} } } })

// Unown is in megas.ts (Mew Box).

// ── Cynthia's Garchomp ───────────────────────────────────────────────────

const CYNTHIA = sel.tagged("Cynthia's")

// Cynthia's Gabite — Champion's Call: Once during your turn, you may search your deck for a Cynthia's Pokémon…
defineCard('DRI-103', { abilities: { "Champion's Call": { *use(x) { yield* searchToHand(x, { filter: CYNTHIA, title: "Choose a Cynthia's Pokémon" }) } } } })

// Cynthia's Garchomp ex — Corkscrew Dive: You may draw cards until you have 6 cards in your hand.
// Draconic Buster: Discard all Energy from this Pokémon.
defineCard('DRI-104', { attacks: {
  *'Corkscrew Dive'(a) {
    damageActive(a, a.base)
    if (a.s.players[a.me].hand.length < 6 && (yield* may(a, 'Draw until you have 6 cards?'))) drawUntil(a, 6)
  },
  *'Draconic Buster'(a) { damageActive(a, a.base); yield* discardAllEnergy(a, a.attacker) },
} })

// Cynthia's Gible — Rock Hurl: This attack's damage isn't affected by Resistance.
defineCard('DRI-102', { attacks: { *'Rock Hurl'(a) { damageActive(a, a.base, { ignoreResistance: true }) } } })

// Cynthia's Roserade — Cheer On to Glory: Attacks used by your Cynthia's Pokémon do 30 more damage to
// your opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('DRI-8', { abilities: { 'Cheer On to Glory': { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, CYNTHIA) ? 30 : 0),
} } } })

// Cynthia's Spiritomb — Raging Curse: This attack does 10 damage for each damage counter on all of your
// Benched Cynthia's Pokémon. This attack's damage isn't affected by Weakness.
defineCard('DRI-129', { attacks: { *'Raging Curse'(a) {
  hitTimes(a, bench(a, a.me, CYNTHIA).reduce((n, s) => n + s.damage / 10, 0), { ignoreWeakness: true })
} } })

// ── Ethan's Typhlosion ───────────────────────────────────────────────────

// Ethan's Cyndaquil — Ember: Discard an Energy from this Pokémon.
defineCard('DRI-32', { attacks: { *Ember(a) {
  damageActive(a, a.base)
  const [uid] = yield* chooseCards(a, { title: 'Discard an Energy from this Pokémon', options: a.attacker.energy })
  if (uid !== undefined) yield* discardAttached(a, [uid])
} } })

// Ethan's Quilava — Bonded by the Journey: Once during your turn, you may search your deck for an Ethan's Adventure card…
defineCard('DRI-33', { abilities: { 'Bonded by the Journey': { *use(x) { yield* searchToHand(x, { filter: sel.named("Ethan's Adventure"), title: "Choose an Ethan's Adventure" }) } } } })

// Ethan's Typhlosion — Buddy Blast: This attack does 60 more damage for each Ethan's Adventure card in your discard pile.
defineCard('DRI-34', { attacks: { *'Buddy Blast'(a) { hitPlus(a, 60 * matching(a, a.s.players[a.me].discard, sel.named("Ethan's Adventure")).length) } } })

// Victini — Victory Cheer: Attacks used by your Evolution {R} Pokémon do 10 more damage to your
// opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('SSP-21', { abilities: { 'Victory Cheer': { modifiers: {
  damageDealt: (src, ctx, ev) => (ev.toActive && ownerOfSlot(ctx, ev.attacker) === src.player && is(ctx, ev.attacker, sel.and(sel.evolutionPokemon, sel.ofType('Fire'))) ? 10 : 0),
} } } })

// ── Grimmsnarl / Froslass ────────────────────────────────────────────────

// Marnie's Grimmsnarl ex — Punk Up: When you play this Pokémon from your hand to evolve 1 of your
// Pokémon during your turn, you may search your deck for up to 5 Basic {D} Energy cards and attach them
// to your Marnie's Pokémon in any way you like. Then, shuffle. Shadow Bullet: This attack also does 30
// damage to 1 of your opponent's Benched Pokémon.
defineCard('DRI-136', {
  abilities: { 'Punk Up': { on: { *evolved(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || !(yield* may(x, 'Use Punk Up?'))) return
    const picks = yield* searchDeck(x, { filter: sel.basicEnergy('Darkness'), max: 5, title: 'Choose up to 5 Basic {D} Energy' })
    for (const uid of picks) {
      const [slot] = yield* choosePokemon(x, { title: `Attach ${nameOf(x, uid)} to 1 of your Marnie's Pokémon`, options: inPlayOf(x, x.me, sel.tagged("Marnie's")) })
      if (slot) yield* attachEnergy(x, uid, slot)
    }
    shuffleDeck(x, x.me)
  } } } },
  attacks: { *'Shadow Bullet'(a) { damageActive(a, a.base); yield* benchHit(a, 30) } },
})

// Marnie's Impidimp — Filch: Draw a card.
defineCard('DRI-134', { attacks: { *Filch(a) { draw(a, 1) } } })

// Froslass — Freezing Shroud: During Pokémon Checkup, put 1 damage counter on each Pokémon that has an
// Ability (both yours and your opponent's), except any Froslass.
defineCard('TWM-53', { abilities: { 'Freezing Shroud': { on: { checkup(x) {
  for (const s of sel.bothInPlay(x)) if (hasWorkingAbility(x, s) && sel.card(x, s).name !== 'Froslass') placeCounters(x, s, 1)
} } } } })

// ── Beedrill, Blaziken, Arboliva ─────────────────────────────────────────

// Weedle — Surprise Attack: Flip a coin. If tails, this attack does nothing.
defineCard('CRI-1', { attacks: { *'Surprise Attack'(a) { if (flip(a)) damageActive(a, a.base) } } })

// Kakuna — Exoskeleton: This Pokémon takes 20 less damage from attacks (after Weakness and Resistance).
defineCard('CRI-2', { abilities: { Exoskeleton: { modifiers: { damageTaken: (src, _c, ev) => (ev.target.id === src.slot?.id ? 20 : 0) } } } })

// Beedrill ex — Rumbling Bees: This attack does 110 damage for each of your Beedrill and Beedrill ex in play.
defineCard('CRI-3', { attacks: { *'Rumbling Bees'(a) { hitTimes(a, inPlayOf(a, a.me, c => c.name === 'Beedrill' || c.name === 'Beedrill ex').length) } } })

// Torchic — Collect: Draw a card. Combusken — Double Kick: Flip 2 coins. 40 damage for each heads.
defineCard('DRI-40', { attacks: { *Collect(a) { draw(a, 1) } } })
defineCard('DRI-41', { attacks: { *'Double Kick'(a) { hitTimes(a, flips(a, 2)) } } })

// Blaziken ex — Seething Spirit: Once during your turn, you may attach a Basic Energy card from your
// discard pile to 1 of your Pokémon. Smolder-sault: During your next turn, this Pokémon can't attack.
defineCard('JTG-24', {
  abilities: { 'Seething Spirit': {
    canUse: x => matching(x, x.s.players[x.me].discard, sel.basicEnergy()).length > 0,
    *use(x) {
      const [uid] = yield* chooseCards(x, { title: 'Attach a Basic Energy from your discard pile', options: matching(x, x.s.players[x.me].discard, sel.basicEnergy()) })
      const [slot] = yield* choosePokemon(x, { title: 'To 1 of your Pokémon', options: inPlayOf(x, x.me) })
      if (uid !== undefined && slot) yield* attachEnergy(x, uid, slot)
    },
  } },
  attacks: { *'Smolder-sault'(a) { damageActive(a, a.base); cantAttackNextTurn(a) } },
})

// Moltres — Fighting Wings: If your opponent's Active Pokémon is a Pokémon ex, this attack does 90 more damage.
defineCard('PFL-14', { attacks: { *'Fighting Wings'(a) { const d = active(a, a.opp); hitPlus(a, d && is(a, d, sel.ex) ? 90 : 0) } } })

// Dolliv — Nutrients: Heal 40 damage from 1 of your Pokémon.
defineCard('DRI-22', { attacks: { *Nutrients(a) {
  const [slot] = yield* choosePokemon(a, { title: 'Heal 40 damage from 1 of your Pokémon', options: inPlayOf(a, a.me) })
  if (slot) heal(a, slot, 40)
} } })

// Arboliva ex — Oil Salvo: Choose 1 of your opponent's Pokémon 6 times. For each time you chose a
// Pokémon, do 20 damage to it. This damage isn't affected by Weakness or Resistance.
// Aroma Shot: This Pokémon recovers from all Special Conditions.
defineCard('DRI-23', { attacks: {
  *'Oil Salvo'(a) {
    const picks = yield* distribute(a, 'Choose 1 of your opponent\'s Pokémon 6 times', inPlayOf(a, a.opp), 6)
    for (const [slot, n] of picks) for (let i = 0; i < n; i++) damage(a, slot, 20, { ignoreWeakness: true, ignoreResistance: true })
  },
  *'Aroma Shot'(a) { damageActive(a, a.base); removeConditions(a, a.attacker) },
} })

// ── Singles ──────────────────────────────────────────────────────────────

// Cacnea — Knock Away: Flip a coin. If heads, this attack does 10 more damage.
defineCard('DLR-4', { attacks: { *'Knock Away'(a) { hitPlus(a, flip(a) ? 10 : 0) } } })

// Cacturne — Linear Attack: This attack does 30 damage to 1 of your opponent's Pokémon. Punishing
// Needles: This attack does 50 more damage for each of your opponent's Pokémon in play that has an Ability.
defineCard('DLR-5', { attacks: {
  *'Linear Attack'(a) {
    const [t] = yield* choosePokemon(a, { title: 'Do 30 damage to 1 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp) })
    if (t) damage(a, t, 30)
  },
  *'Punishing Needles'(a) { hitPlus(a, 50 * inPlayOf(a, a.opp).filter(s => hasWorkingAbility(a, s)).length) },
} })

// Chi-Yu (PBL) — Whirling Envy: If this Pokémon has 2 or more damage counters on it, this attack does
// 90 more damage. This attack's damage isn't affected by Weakness.
defineCard('PBL-59', { attacks: { *'Whirling Envy'(a) { hitPlus(a, a.attacker.damage >= 20 ? 90 : 0, { ignoreWeakness: true }) } } })

// Chi-Yu (TWM) — Allure: Draw 2 cards. Ground Melter: If a Stadium is in play, this attack does 60 more
// damage. Then, discard that Stadium.
defineCard('TWM-39', { attacks: {
  *Allure(a) { draw(a, 2) },
  *'Ground Melter'(a) {
    const stadium = a.s.stadium !== null
    hitPlus(a, stadium ? 60 : 0)
    if (stadium) yield* discardStadium(a)
  },
} })

// Eevee ex — Rainbow DNA: This Pokémon can evolve into any Pokémon ex that evolves from Eevee if you
// play it from your hand onto this Pokémon.
defineCard('PRE-75', { abilities: { 'Rainbow DNA': { modifiers: {
  evolvesFrom: (src, ctx, slot, uid) => {
    const c = ctx.db.card(ctx.s.cards[uid].cardId)
    return src.slot?.id === slot.id && sel.ex(c) && c.evolveFrom === 'Eevee'
  },
} } } })

// Empoleon ex — Emperor's Stance: Prevent all effects of attacks used by your opponent's Pokémon done to
// this Pokémon. Iron Feathers: During your opponent's next turn, this Pokémon takes 60 less damage.
defineCard('PFL-70', {
  abilities: { "Emperor's Stance": { modifiers: {
    preventEffect: (src, _c, r) => r.target.id === src.slot?.id && r.from === 'attack' && r.by !== src.player,
  } } },
  attacks: { *'Iron Feathers'(a) { damageActive(a, a.base); takesLessNextTurn(a, 60) } },
})

// Enamorus — Love Resonance: If any of your Pokémon in play are the same type as any of your
// opponent's Pokémon in play, this attack does 120 more damage.
defineCard('TWM-93', { attacks: { *'Love Resonance'(a) {
  const mine = new Set(inPlayOf(a, a.me).flatMap(s => sel.card(a, s).types ?? []))
  const shared = inPlayOf(a, a.opp).some(s => (sel.card(a, s).types ?? []).some(t => mine.has(t)))
  hitPlus(a, shared ? 120 : 0)
} } })

// Haxorus — Cross-Cut: If your opponent's Active Pokémon is an Evolution Pokémon, 80 more damage.
// Axe Blast: If your opponent's Active Pokémon is a Basic Pokémon, it is Knocked Out.
defineCard('BLK-70', { attacks: {
  *'Cross-Cut'(a) { const d = active(a, a.opp); hitPlus(a, d && is(a, d, sel.evolutionPokemon) ? 80 : 0) },
  *'Axe Blast'(a) { const d = active(a, a.opp); if (d && is(a, d, sel.basicPokemon) && reaches(a, d)) knockOut(a, d) },
} })

// Hoothoot — Triple Stab: Flip 3 coins. 10 damage for each heads.
defineCard('SCR-114', { attacks: { *'Triple Stab'(a) { hitTimes(a, flips(a, 3)) } } })

// Pikipek — Double Stab: Flip 2 coins. 10 damage for each heads.
defineCard('PBL-66', { attacks: { *'Double Stab'(a) { hitTimes(a, flips(a, 2)) } } })

// Iron Leaves ex — Rapid Vernier: When you play this Pokémon from your hand onto your Bench during your
// turn, you may switch it with your Active Pokémon. If you do, you may move any amount of Energy from
// your other Pokémon to this Pokémon. Prism Edge: During your next turn, this Pokémon can't attack.
defineCard('TEF-25', {
  abilities: { 'Rapid Vernier': { on: { *playedToBench(x, ev) {
    if (ev.slot.id !== x.self?.id || !ev.fromHand || !x.s.players[x.me].active || !(yield* may(x, 'Use Rapid Vernier?'))) return
    switchActive(x, x.me, x.self.id)
    const self = x.self
    const options = inPlayOf(x, x.me).filter(s => s.id !== self.id).flatMap(s => s.energy)
    const picks = yield* chooseCards(x, { title: 'Move any amount of Energy to this Pokémon', options, min: 0, max: options.length })
    for (const uid of picks) moveEnergy(x, uid, self)
  } } } },
  attacks: { *'Prism Edge'(a) { damageActive(a, a.base); cantAttackNextTurn(a) } },
})

// Jirachi ex — Wish Granter: Draw cards until you have 7 cards in your hand. Swift: This attack's damage
// isn't affected by Weakness or Resistance, or by any effects on your opponent's Active Pokémon.
defineCard('30C-102', { attacks: {
  *'Wish Granter'(a) { drawUntil(a, 7) },
  *Swift(a) { damageActive(a, a.base, { ignoreWeakness: true, ignoreResistance: true, ignoreDefenderEffects: true }) },
} })

// Jolteon ex — Flashing Spear: You may discard up to 2 Basic Energy from your Benched Pokémon. This
// attack does 90 more damage for each card discarded. Dravite: During your next turn, this Pokémon can't attack.
defineCard('PRE-30', { attacks: {
  *'Flashing Spear'(a) {
    const picks = yield* chooseCards(a, { title: 'Discard up to 2 Basic Energy from your Benched Pokémon', options: bench(a, a.me).flatMap(s => matching(a, s.energy, sel.basicEnergy())), min: 0, max: 2 })
    yield* discardAttached(a, picks)
    hitPlus(a, 90 * picks.length)
  },
  *Dravite(a) { damageActive(a, a.base); cantAttackNextTurn(a) },
} })

// Lucario (30C) — Aura Sphere: This attack also does 60 damage to 1 of your opponent's Benched Pokémon.
defineCard('30C-83', { attacks: { *'Aura Sphere'(a) { damageActive(a, a.base); yield* benchHit(a, 60) } } })

// Lugia (30C) — Elemental Blast: Discard a {R} Energy, a {W} Energy, and a {L} Energy from this Pokémon.
defineCard('30C-121', { attacks: { *'Elemental Blast'(a) {
  damageActive(a, a.base)
  const picked: number[] = []
  for (const [t, symbol] of [['Fire', 'R'], ['Water', 'W'], ['Lightning', 'L']] as const) {
    const options = a.attacker.energy.filter(u => !picked.includes(u) && energyAlternatives(a, a.attacker, u).some(alt => alt.includes(t) || alt.includes('Any')))
    const [uid] = yield* chooseCards(a, { title: `Discard a {${symbol}} Energy`, options })
    if (uid !== undefined) picked.push(uid)
  }
  yield* discardAttached(a, picked)
} } })

// N's Darmanitan — Back Draft: 30 damage for each Basic Energy card in your opponent's discard pile.
// Flamebody Cannon: Discard all Energy from this Pokémon, and this attack also does 90 damage to 1 of
// your opponent's Benched Pokémon.
defineCard('JTG-27', { attacks: {
  *'Back Draft'(a) { hitTimes(a, matching(a, a.s.players[a.opp].discard, sel.basicEnergy()).length) },
  *'Flamebody Cannon'(a) { damageActive(a, a.base); yield* discardAllEnergy(a, a.attacker); yield* benchHit(a, 90) },
} })

// Noctowl — Jewel Seeker: Once during your turn, when you play this Pokémon from your hand to evolve 1
// of your Pokémon, if you have any Tera Pokémon in play, you may search your deck for up to 2 Trainer cards…
defineCard('SCR-115', { abilities: { 'Jewel Seeker': { on: { *evolved(x, ev) {
  if (ev.slot.id !== x.self?.id || !ev.fromHand || !inPlayOf(x, x.me, sel.tera).length) return
  if (yield* may(x, 'Use Jewel Seeker?')) yield* searchToHand(x, { filter: sel.trainer, max: 2, title: 'Choose up to 2 Trainer cards' })
} } } } })

// Okidogi — Adrena-Power: If this Pokémon has any {D} Energy attached, it gets +100 HP, and the attacks
// it uses do 100 more damage to your opponent's Active Pokémon (before applying Weakness and Resistance).
defineCard('TWM-111', { abilities: { 'Adrena-Power': { modifiers: {
  hp: (src, ctx, slot) => (src.slot?.id === slot.id && energyOn(ctx, slot, 'Darkness').length ? 100 : 0),
  damageDealt: (src, ctx, ev) => (ev.toActive && src.slot?.id === ev.attacker.id && energyOn(ctx, ev.attacker, 'Darkness').length ? 100 : 0),
} } } })

// Paldean Tauros — Spirited Tackle: If your opponent's Active Pokémon is a Stage 1 Pokémon, 90 more damage.
defineCard('SSP-18', { attacks: { *'Spirited Tackle'(a) { const d = active(a, a.opp); hitPlus(a, d && is(a, d, sel.stage('Stage 1')) ? 90 : 0) } } })

// Pawmot — Voltaic Fist: You may have this Pokémon also do 60 damage to itself and make your
// opponent's Active Pokémon Paralyzed.
defineCard('PFL-34', { attacks: { *'Voltaic Fist'(a) {
  damageActive(a, a.base)
  if (!(yield* may(a, 'Do 60 damage to this Pokémon to Paralyze the Defending Pokémon?'))) return
  selfDamage(a, 60)
  const d = active(a, a.opp)
  if (d) applyCondition(a, d, 'paralyzed')
} } })

// Piplup — Call for Support: Search your deck for a Supporter card…
defineCard('PFL-27', { attacks: { *'Call for Support'(a) { yield* searchToHand(a, { filter: sel.trainerOf('Supporter'), title: 'Choose a Supporter' }) } } })

// Reshiram (30C) — Laser Flame: If this Pokémon has any {L} Energy attached, this attack does 80 more damage.
defineCard('30C-14', { attacks: { *'Laser Flame'(a) { hitPlus(a, energyOn(a, a.attacker, 'Lightning').length ? 80 : 0) } } })

// Reshiram ex — Blazing Burst: 50 more damage for each Prize card your opponent has taken. Discard an
// Energy from this Pokémon.
defineCard('WHT-20', { attacks: { *'Blazing Burst'(a) {
  hitPlus(a, 50 * prizesTaken(a, a.opp))
  const [uid] = yield* chooseCards(a, { title: 'Discard an Energy from this Pokémon', options: a.attacker.energy })
  if (uid !== undefined) yield* discardAttached(a, [uid])
} } })

// Tapu Bulu — Wood Hammer: This Pokémon also does 30 damage to itself.
defineCard('SFA-6', { attacks: { *'Wood Hammer'(a) { damageActive(a, a.base); selfDamage(a, 30) } } })

// Tapu Koko ex — Linked Lightning: This attack does 20 more damage for each of your Benched Pokémon.
defineCard('JTG-51', { attacks: { *'Linked Lightning'(a) { hitPlus(a, 20 * bench(a, a.me).length) } } })

// Terapagos ex — Unified Beatdown: If you go second, you can't use this attack during your first turn.
// This attack does 30 damage for each of your Benched Pokémon. Crown Opal: During your opponent's next
// turn, prevent all damage done to this Pokémon by attacks from Basic non-{C} Pokémon.
defineCard('SCR-128', { attacks: {
  'Unified Beatdown': {
    canUse: a => !(a.s.firstPlayer !== a.me && sel.wentFirst(a, a.opp) && a.s.turn === 2),
    *run(a) { hitTimes(a, bench(a, a.me).length) },
  },
  *'Crown Opal'(a) { damageActive(a, a.base); addMarker(a, CROWN_OPAL, { until: 'opponentsNextTurn', slot: a.attacker }) },
} })

// Toucannon — Aerial Draw: Once during your turn, you may use this Ability. Draw a card. Feather Rondo:
// This attack does 20 more damage for each Benched Pokémon (both yours and your opponent's).
defineCard('PBL-68', {
  abilities: { 'Aerial Draw': { canUse: x => x.s.players[x.me].deck.length > 0, *use(x) { draw(x, 1) } } },
  attacks: { *'Feather Rondo'(a) { hitPlus(a, 20 * (bench(a, a.me).length + bench(a, a.opp).length)) } },
})

// Volcanion ex — Scalding Steam: Once during your turn, if this Pokémon is in the Active Spot, you may
// make your opponent's Active Pokémon Burned. Scorching Cyclone: Move an Energy from this Pokémon to 1
// of your Benched Pokémon.
defineCard('JTG-31', {
  abilities: { 'Scalding Steam': {
    canUse: x => !!x.self && isActive(x, x.self) && !!active(x, x.opp),
    *use(x) { applyCondition(x, active(x, x.opp)!, 'burned') },
  } },
  attacks: { *'Scorching Cyclone'(a) {
    damageActive(a, a.base)
    if (!a.attacker.energy.length || !bench(a, a.me).length) return
    const [uid] = yield* chooseCards(a, { title: 'Move an Energy from this Pokémon', options: a.attacker.energy })
    const [to] = yield* choosePokemon(a, { title: 'To 1 of your Benched Pokémon', options: bench(a, a.me) })
    if (uid !== undefined && to) moveEnergy(a, uid, to)
  } },
})

