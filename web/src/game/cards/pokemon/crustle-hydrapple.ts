// Crustle (Azurill, Dwebble, Crustle, Cornerstone Mask Ogerpon ex) and Hydrapple (Meganium,
// Celebi, Bayleef, Hydrapple ex, Applin, Dipplin).

import {
  attachEnergy, chooseCards, choosePokemon, damageActive, defineCard, evolveWith, flip, heal, matching, pushOut,
  reaches, searchDeck, searchToHand, sel, shuffleDeck, type AbilityImpl,
} from '../fx'
import { hitPlus, hitTimes } from './common'

const { bench, energyCount, hasWorkingAbility, inPlayOf, is, ownerOfSlot } = sel

// Azurill — Bouncy-Bounce Charge: Search your deck for an Energy card and attach it to 1 of your
// Benched Pokémon. Then, shuffle your deck.
defineCard('DLR-80', { attacks: { *'Bouncy-Bounce Charge'(a) {
  const [uid] = yield* searchDeck(a, { filter: sel.energyCard, title: 'Choose an Energy card' })
  if (uid !== undefined) {
    const [slot] = yield* choosePokemon(a, { title: 'Attach it to 1 of your Benched Pokémon', options: bench(a, a.me) })
    if (slot) yield* attachEnergy(a, uid, slot)
  }
  shuffleDeck(a, a.me)
} } })

// Dwebble — Ascension: Search your deck for a card that evolves from this Pokémon and put it onto
// this Pokémon to evolve it. Then, shuffle your deck.
defineCard('DRI-11', { attacks: { *Ascension(a) {
  const name = sel.card(a, a.attacker).name
  const [uid] = yield* searchDeck(a, { filter: c => c.kind === 'pokemon' && c.evolveFrom === name, title: `Choose a card that evolves from ${name}` })
  if (uid !== undefined) yield* evolveWith(a, a.attacker, uid)
  shuffleDeck(a, a.me)
} } })

// Crustle — Mysterious Rock Inn: Prevent all damage done to this Pokémon by attacks from your
// opponent's Pokémon ex. Superb Scissors: This attack's damage isn't affected by any effects on your
// opponent's Active Pokémon.
defineCard('DRI-12', {
  abilities: { 'Mysterious Rock Inn': { modifiers: {
    preventDamage: (src, ctx, ev) => ev.target.id === src.slot?.id && ownerOfSlot(ctx, ev.attacker) !== src.player && is(ctx, ev.attacker, sel.ex),
  } } },
  attacks: { *'Superb Scissors'(a) { damageActive(a, a.base, { ignoreDefenderEffects: true }) } },
})

// Cornerstone Mask Ogerpon ex — Cornerstone Stance: Prevent all damage from attacks done to this
// Pokémon by your opponent's Pokémon that have an Ability. Demolish: This attack's damage isn't
// affected by Weakness or Resistance, or by any effects on your opponent's Active Pokémon.
defineCard('TWM-112', {
  abilities: { 'Cornerstone Stance': { modifiers: {
    preventDamage: (src, ctx, ev) => ev.target.id === src.slot?.id && ownerOfSlot(ctx, ev.attacker) !== src.player && hasWorkingAbility(ctx, ev.attacker),
  } } },
  attacks: { *Demolish(a) { damageActive(a, a.base, { ignoreWeakness: true, ignoreResistance: true, ignoreDefenderEffects: true }) } },
})

// Meganium — Wild Growth: Each Basic {G} Energy attached to all of your Pokémon provides {G}{G}
// Energy. The effect of Wild Growth doesn't stack.
defineCard('MEG-10', { abilities: { 'Wild Growth': { modifiers: {
  energy: (src, ctx, slot, uid, alts) => {
    const c = ctx.db.card(ctx.s.cards[uid].cardId)
    const plain = alts.length === 1 && alts[0].length === 1 && alts[0][0] === 'Grass'
    return ownerOfSlot(ctx, slot) === src.player && sel.basicEnergy('Grass')(c) && plain ? [['Grass', 'Grass']] : alts
  },
} } } })

// Celebi — Traverse Time: Search your deck for up to 3 in any combination of {G} Pokémon and Stadium cards…
defineCard('MEG-12', { attacks: { *'Traverse Time'(a) {
  yield* searchToHand(a, { filter: sel.or(sel.ofType('Grass'), sel.trainerOf('Stadium')), max: 3, title: 'Choose up to 3 {G} Pokémon and Stadium cards' })
} } })

// Bayleef — Push Down: Switch out your opponent's Active Pokémon to the Bench. (Your opponent
// chooses the new Active Pokémon.)
defineCard('MEG-9', { attacks: { *'Push Down'(a) {
  damageActive(a, a.base)
  if (a.defender && reaches(a, a.defender)) yield* pushOut(a)
} } })

// Hydrapple ex — Ripening Charge: Once during your turn, you may attach a Basic {G} Energy card from
// your hand to 1 of your Pokémon. If you attached Energy in this way, heal 30 damage from that
// Pokémon. Syrup Storm: This attack does 30 more damage for each {G} Energy attached to all of your Pokémon.
defineCard('SCR-14', {
  abilities: { 'Ripening Charge': {
    canUse: x => matching(x, x.s.players[x.me].hand, sel.basicEnergy('Grass')).length > 0,
    *use(x) {
      const [uid] = yield* chooseCards(x, { title: 'Attach a Basic {G} Energy', options: matching(x, x.s.players[x.me].hand, sel.basicEnergy('Grass')) })
      const [slot] = yield* choosePokemon(x, { title: 'To 1 of your Pokémon', options: inPlayOf(x, x.me) })
      if (uid === undefined || !slot) return
      yield* attachEnergy(x, uid, slot)
      heal(x, slot, 30)
    },
  } },
  attacks: { *'Syrup Storm'(a) {
    hitPlus(a, 30 * inPlayOf(a, a.me).reduce((n, s) => n + energyCount(a, s, 'Grass'), 0))
  } },
})

// Applin (TWM-17) — Tumbling Attack: Flip a coin. If heads, this attack does 20 more damage.
defineCard('TWM-17', { attacks: { *'Tumbling Attack'(a) { hitPlus(a, flip(a) ? 20 : 0) } } })

// Dipplin — Festival Lead: If Festival Grounds is in play, this Pokémon may use an attack it has
// twice. If the first attack Knocks Out your opponent's Active Pokémon, you may attack again after
// your opponent chooses a new Active Pokémon. Do the Wave: This attack does 20 damage for each of
// your Benched Pokémon.
export const festivalLead: AbilityImpl = {
  modifiers: {
    attackAgain: (src, ctx, slot, knockedOut) => src.slot?.id === slot.id && knockedOut && sel.stadiumIs(ctx, 'Festival Grounds'),
  },
}
defineCard('TWM-18', {
  abilities: { 'Festival Lead': festivalLead },
  attacks: { *'Do the Wave'(a) { hitTimes(a, bench(a, a.me).length) } },
})
