// Dhelmise (Hide 'n' Sneak Pokémon, Spiritomb, Bloodmoon Ursaluna ex) and Festival Lead (Seaking,
// Rellor, Rabsca, Applin, Thwackey, Goldeen).

import {
  chooseCards, choosePokemon, damageActive, defineCard, discardAttached, draw, flip, moveCards, placeCounters,
  searchDeck, searchToHand, sel, selfDamage, shuffleDeck, type AbilityImpl,
} from '../fx'
import { festivalLead } from './crustle-hydrapple'
import { cantAttackNextTurn, discardWithAbility, hitPlus } from './common'

const { active, energyCount, inPlayOf, isActive, ownerOfSlot } = sel
const SNEAK = "Hide 'n' Sneak"

// Hide 'n' Sneak: Prevent all effects of your opponent's Pokémon's attacks and Abilities done to this
// Pokémon. (Damage is not an effect.)
const hideNSneak: AbilityImpl = { modifiers: {
  preventEffect: (src, _c, r) => r.target.id === src.slot?.id && r.by !== src.player && (r.from === 'attack' || r.from === 'ability'),
} }

// Shuppet
defineCard('PBL-33', { abilities: { [SNEAK]: hideNSneak } })

// Banette — Puppet Pull: You may search your deck for a card and put it into your hand. Then, shuffle.
defineCard('PBL-34', {
  abilities: { [SNEAK]: hideNSneak },
  attacks: { *'Puppet Pull'(a) {
    damageActive(a, a.base)
    const picks = yield* searchDeck(a, { filter: sel.any, title: 'You may choose a card' })
    moveCards(a, picks, 'hand')
    shuffleDeck(a, a.me)
  } },
})

// Dhelmise — Vengeful Anchor: If you have 4 or more Pokémon that have the Hide 'n' Sneak Ability in
// your discard pile, this attack does 140 more damage.
defineCard('PBL-39', { attacks: { *'Vengeful Anchor'(a) { hitPlus(a, discardWithAbility(a, a.me, SNEAK) >= 4 ? 140 : 0) } } })

// Poltchageist — Furtive Drop: Place 1 damage counter on your opponent's Active Pokémon.
defineCard('PBL-5', {
  abilities: { [SNEAK]: hideNSneak },
  attacks: { *'Furtive Drop'(a) { const d = active(a, a.opp); if (d) placeCounters(a, d, 1) } },
})

// Sinistcha — Matcha Spin: If you have 6 or more Pokémon that have the Hide 'n' Sneak Ability in your
// discard pile, place 4 damage counters on each of your opponent's Pokémon.
defineCard('PBL-6', {
  abilities: { [SNEAK]: hideNSneak },
  attacks: { *'Matcha Spin'(a) {
    if (discardWithAbility(a, a.me, SNEAK) >= 6) for (const s of inPlayOf(a, a.opp)) placeCounters(a, s, 4)
  } },
})

// Spiritomb (PBL) — Spiritual End: If you have 13 or more Pokémon that have the Hide 'n' Sneak
// Ability in your discard pile, choose 2 of your opponent's Pokémon and quadruple the number of
// damage counters on each of them.
defineCard('PBL-35', { attacks: { *'Spiritual End'(a) {
  if (discardWithAbility(a, a.me, SNEAK) < 13) return
  const targets = yield* choosePokemon(a, { title: 'Choose 2 of your opponent\'s Pokémon', options: inPlayOf(a, a.opp), min: 2, max: 2 })
  for (const t of targets) placeCounters(a, t, 3 * (t.damage / 10))
} } })

// Bloodmoon Ursaluna ex — Seasoned Skill: Blood Moon used by this Pokémon costs {C} less for each
// Prize card your opponent has taken. Blood Moon: During your next turn, this Pokémon can't attack.
defineCard('TWM-141', {
  abilities: { 'Seasoned Skill': { modifiers: {
    attackCost: (src, ctx, slot, attack, cost) => {
      if (src.slot?.id !== slot.id || attack.name !== 'Blood Moon') return cost
      let drop = sel.prizesTaken(ctx, src.player === 0 ? 1 : 0)
      return cost.filter(t => !(t === 'Colorless' && drop-- > 0))
    },
  } } },
  attacks: { *'Blood Moon'(a) { damageActive(a, a.base); cantAttackNextTurn(a) } },
})

// Seaking — Festival Lead. Rapid Draw: Draw 2 cards.
defineCard('PRE-21', { abilities: { 'Festival Lead': festivalLead }, attacks: { *'Rapid Draw'(a) { damageActive(a, a.base); draw(a, 2) } } })

// Goldeen (TWM) — Festival Lead. Whirlpool: Flip a coin. If heads, discard an Energy from your
// opponent's Active Pokémon.
defineCard('TWM-44', {
  abilities: { 'Festival Lead': festivalLead },
  attacks: { *Whirlpool(a) {
    damageActive(a, a.base)
    const d = active(a, a.opp)
    if (!d || !d.energy.length || !flip(a)) return
    const [uid] = yield* chooseCards(a, { title: 'Discard an Energy from the Defending Pokémon', options: d.energy })
    if (uid !== undefined) yield* discardAttached(a, [uid])
  } },
})

// Rellor (DRI) — Collect: Draw a card.
defineCard('DRI-24', { attacks: { *Collect(a) { draw(a, 1) } } })

// Rellor (TEF) — Slight Intrusion: This Pokémon also does 10 damage to itself.
defineCard('TEF-23', { attacks: { *'Slight Intrusion'(a) { damageActive(a, a.base); selfDamage(a, 10) } } })

// Rabsca — Spherical Shield: Prevent all damage from and effects of attacks from your opponent's
// Pokémon done to your Benched Pokémon. Psychic: 30 more damage for each Energy attached to your
// opponent's Active Pokémon.
defineCard('TEF-24', {
  abilities: { 'Spherical Shield': { modifiers: {
    preventDamage: (src, ctx, ev) => ownerOfSlot(ctx, ev.target) === src.player && !isActive(ctx, ev.target) && ownerOfSlot(ctx, ev.attacker) !== src.player,
    preventEffect: (src, ctx, r) => r.from === 'attack' && r.by !== src.player && ownerOfSlot(ctx, r.target) === src.player && !isActive(ctx, r.target),
  } } },
  attacks: { *Psychic(a) { const d = active(a, a.opp); hitPlus(a, d ? 30 * energyCount(a, d) : 0) } },
})

// Applin (TWM-126) — Find a Friend: Search your deck for a Pokémon…
defineCard('TWM-126', { attacks: { *'Find a Friend'(a) { yield* searchToHand(a, { filter: sel.pokemon, title: 'Choose a Pokémon' }) } } })

// Thwackey — Boom Boom Groove: Once during your turn, if your Active Pokémon has the Festival Lead
// Ability, you may search your deck for a card and put it into your hand. Then, shuffle your deck.
defineCard('TWM-15', { abilities: { 'Boom Boom Groove': {
  canUse: x => { const a = active(x, x.me); return !!a && (sel.card(x, a).abilities ?? []).some(ab => ab.name === 'Festival Lead') },
  *use(x) {
    const picks = yield* searchDeck(x, { filter: sel.any, title: 'Choose a card' })
    moveCards(x, picks, 'hand')
    shuffleDeck(x, x.me)
  },
} } })

