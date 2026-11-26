// State changes card effects are made of. Every op takes the effect's
// context (X) and goes through the engine's checks: effect prevention,
// healing and counter-moving locks, Special Condition immunity, events.

import type { CatalogAttack } from '../catalog/types'
import { evolveSlot, leaveHandlers } from '../engine/actions'
import { hit, runAttack, type DamageOptions } from '../engine/attack'
import { emit } from '../engine/events'
import type { AttackX, Condition, EffectReach, X } from '../engine/impl'
import { allowed, each } from '../engine/modifiers'
import { ask } from '../engine/prompt'
import { coin, shuffleInPlace } from '../engine/rng'
import {
  canHeal, canMoveCounters, cardOf, discardSlot, draw as drawCards, inPlay, log, maxHp, nameOf, newSlot,
  other, ownerOf, shuffleDeck, slotCards, slotName, switchActive, benchLimit,
} from '../engine/rules'
import { promote } from '../engine/turn'
import type { Marker, PlayerId, Proc, Slot } from '../engine/types'
import { matching, type CardFilter } from './select'

// ── prompts ──────────────────────────────────────────────────────────────

/** "You may …": asks the player (the effect's owner by default). */
export function* may(x: X, title: string, player: PlayerId = x.me): Proc<boolean> {
  const [yes] = yield* ask({ kind: 'yesNo', player, title })
  return yes === 1
}

export function* chooseCards(x: X, o: { title: string; options: number[]; min?: number; max?: number; player?: PlayerId; hidden?: boolean }): Proc<number[]> {
  return yield* ask({ kind: 'chooseCards', player: o.player ?? x.me, title: o.title, options: o.options, min: o.min ?? 1, max: o.max ?? 1, hidden: o.hidden })
}

export function* choosePokemon(x: X, o: { title: string; options: Slot[]; min?: number; max?: number; player?: PlayerId }): Proc<Slot[]> {
  const ids = yield* ask({ kind: 'choosePokemon', player: o.player ?? x.me, title: o.title, options: o.options.map(s => s.id), min: o.min ?? 1, max: o.max ?? 1 })
  return ids.map(id => o.options.find(s => s.id === id)!)
}

/** One Pokémon, or null when there are none to choose. */
export function* chooseOne(x: X, title: string, options: Slot[], player: PlayerId = x.me): Proc<Slot | null> {
  const [slot] = yield* choosePokemon(x, { title, options, player })
  return slot ?? null
}

export function* chooseOption(x: X, title: string, options: string[], player: PlayerId = x.me): Proc<number> {
  const [i] = yield* ask({ kind: 'chooseOption', player, title, options })
  return i
}

export function* orderCards(x: X, title: string, cards: number[], player: PlayerId = x.me): Proc<number[]> {
  return yield* ask({ kind: 'order', player, title, cards })
}

/** Splits `total` among Pokémon; returns [slot, count] for each that got some. */
export function* distribute(x: X, title: string, options: Slot[], total: number, player: PlayerId = x.me): Proc<[Slot, number][]> {
  if (!options.length || total <= 0) return []
  const counts = yield* ask({ kind: 'distribute', player, title, options: options.map(s => s.id), total })
  return options.map((s, i) => [s, counts[i]] as [Slot, number]).filter(([, n]) => n > 0)
}

// ── coins ────────────────────────────────────────────────────────────────

export function flip(x: X): boolean {
  const heads = coin(x.s)
  log(x, x.me, `Flips a coin: ${heads ? 'heads' : 'tails'}.`)
  return heads
}

/** Heads among n flips. */
export function flips(x: X, n: number): number {
  let heads = 0
  for (let i = 0; i < n; i++) if (coin(x.s)) heads++
  log(x, x.me, `Flips ${n} coins: ${heads} heads.`)
  return heads
}

export function flipUntilTails(x: X): number {
  let heads = 0
  while (coin(x.s)) heads++
  log(x, x.me, `Flips until tails: ${heads} heads.`)
  return heads
}

// ── zones ────────────────────────────────────────────────────────────────

/** Takes a card out of whatever zone or Pokémon holds it. */
export function takeCard(x: X, uid: number): void {
  const s = x.s
  const i = s.resolving.indexOf(uid)
  if (i >= 0) { s.resolving.splice(i, 1); return }
  if (s.stadium === uid) { s.stadium = null; return }
  for (const pl of s.players) {
    for (const zone of [pl.deck, pl.hand, pl.discard, pl.prizes]) {
      const j = zone.indexOf(uid)
      if (j >= 0) { zone.splice(j, 1); return }
    }
    for (const slot of inPlay(pl)) {
      for (const list of [slot.energy, slot.tools]) {
        const j = list.indexOf(uid)
        if (j >= 0) { list.splice(j, 1); return }
      }
    }
  }
  throw new Error(`card ${uid} isn't in a zone`)
}

export type Zone = 'hand' | 'discard' | 'deckTop' | 'deckBottom'

/** Moves cards to their owner's zone, in order. */
export function moveCards(x: X, uids: number[], to: Zone): void {
  for (const uid of uids) {
    takeCard(x, uid)
    const pl = x.s.players[ownerOf(x, uid)]
    if (to === 'hand') pl.hand.push(uid)
    else if (to === 'discard') pl.discard.push(uid)
    else if (to === 'deckTop') pl.deck.unshift(uid)
    else pl.deck.push(uid)
  }
}

/** Moves cards into their owner's deck and shuffles it. */
export function shuffleIntoDeck(x: X, uids: number[], p: PlayerId = x.me): void {
  moveCards(x, uids, 'deckBottom')
  shuffleDeck(x, p)
}

export function draw(x: X, n: number, p: PlayerId = x.me): number {
  const k = drawCards(x, p, n)
  if (k) log(x, p, `Draws ${k} card${k === 1 ? '' : 's'}.`)
  return k
}

export function drawUntil(x: X, n: number, p: PlayerId = x.me): number {
  return draw(x, Math.max(0, n - x.s.players[p].hand.length), p)
}

export function shuffleHandIntoDeck(x: X, p: PlayerId = x.me): void {
  const pl = x.s.players[p]
  pl.deck.push(...pl.hand.splice(0))
  shuffleDeck(x, p)
}

/** Shuffles the hand and puts it on the bottom of the deck. Returns how many cards. */
export function handToDeckBottom(x: X, p: PlayerId = x.me): number {
  const pl = x.s.players[p]
  const hand = pl.hand.splice(0)
  shuffleInPlace(x.s, hand)
  pl.deck.push(...hand)
  return hand.length
}

export function discardHand(x: X, p: PlayerId = x.me): void {
  const pl = x.s.players[p]
  pl.discard.push(...pl.hand.splice(0))
}

/**
 * Searches a deck for up to `max` cards passing the filter (a search of a
 * hidden zone may come up empty, so `min` defaults to 0). Returns the
 * picked uids, still in the deck: move them with the op the card names.
 */
export function* searchDeck(x: X, o: { filter: CardFilter; max?: number; min?: number; title: string; player?: PlayerId; valid?: (picked: number[]) => boolean }): Proc<number[]> {
  const p = o.player ?? x.me
  const options = matching(x, x.s.players[p].deck, o.filter)
  return yield* chooseCards(x, { title: o.title, options, min: o.min ?? 0, max: o.max ?? 1, player: p })
}

/** Search, put the cards into the hand, shuffle. */
export function* searchToHand(x: X, o: { filter: CardFilter; max?: number; title: string }): Proc<number[]> {
  const picks = yield* searchDeck(x, o)
  moveCards(x, picks, 'hand')
  if (picks.length) log(x, x.me, `Puts ${picks.map(u => nameOf(x, u)).join(', ')} into their hand.`)
  shuffleDeck(x, x.me)
  return picks
}

/** Puts a Basic Pokémon card onto its owner's Bench (not "played from hand"). */
export function* putOntoBench(x: X, uid: number): Proc<Slot | null> {
  const p = ownerOf(x, uid)
  const pl = x.s.players[p]
  if (pl.bench.length >= benchLimit(x, p)) return null
  const fromHand = pl.hand.includes(uid)
  takeCard(x, uid)
  const slot = newSlot(uid, x.s.turn)
  pl.bench.push(slot)
  log(x, p, `Puts ${nameOf(x, uid)} onto the Bench.`)
  yield* emit(x, { type: 'playedToBench', slot, player: p, fromHand })
  return slot
}

/** Search for Basic Pokémon and put them onto the Bench, then shuffle. */
export function* searchToBench(x: X, o: { filter: CardFilter; max: number; title: string }): Proc<Slot[]> {
  const room = benchLimit(x, x.me) - x.s.players[x.me].bench.length
  const picks = yield* searchDeck(x, { ...o, max: Math.min(o.max, room) })
  const out: Slot[] = []
  for (const uid of picks) {
    const slot = yield* putOntoBench(x, uid)
    if (slot) out.push(slot)
  }
  shuffleDeck(x, x.me)
  return out
}

/** The top n cards of a deck (not moved). */
export function topCards(x: X, n: number, p: PlayerId = x.me): number[] {
  return x.s.players[p].deck.slice(0, n)
}

export function bottomCards(x: X, n: number, p: PlayerId = x.me): number[] {
  const deck = x.s.players[p].deck
  return deck.slice(Math.max(0, deck.length - n))
}

/** Discards cards from a player's hand, chosen by that player (or `chooser`). */
export function* discardFromHand(x: X, o: { min: number; max: number; filter?: CardFilter; player?: PlayerId; chooser?: PlayerId; title?: string; except?: number[] }): Proc<number[]> {
  const p = o.player ?? x.me
  const hand = x.s.players[p].hand.filter(u => !(o.except ?? []).includes(u))
  const options = o.filter ? matching(x, hand, o.filter) : hand
  const picks = yield* chooseCards(x, { title: o.title ?? 'Choose cards to discard', options, min: o.min, max: o.max, player: o.chooser ?? p })
  moveCards(x, picks, 'discard')
  if (picks.length) log(x, p, `Discards ${picks.map(u => nameOf(x, u)).join(', ')}.`)
  return picks
}

// ── Pokémon in play ──────────────────────────────────────────────────────

function owner(x: X, slot: Slot): PlayerId {
  return ownerOf(x, slot.id)
}

/** Can this effect reach the Pokémon (not prevented by its protections)? */
export function reaches(x: X, target: Slot, what: EffectReach['what'] = 'effect'): boolean {
  const reach: EffectReach = { from: x.effect, by: x.me, target, what }
  return !each(x, 'preventEffect').some(([src, f]) => f(src, x, reach))
}

export function heal(x: X, slot: Slot, n: number): number {
  if (!canHeal(x, slot)) return 0
  const healed = Math.min(slot.damage, n)
  slot.damage -= healed
  if (healed) log(x, owner(x, slot), `${slotName(x, slot)} heals ${healed} damage.`)
  return healed
}

export function applyCondition(x: X, slot: Slot, c: Condition): boolean {
  if (!reaches(x, slot)) return false
  if (!x.s.players[owner(x, slot)].active || x.s.players[owner(x, slot)].active!.id !== slot.id) return false
  if (!allowed(x, 'canHaveCondition', slot, c)) return false
  if (c === 'poisoned') slot.poisoned = true
  else if (c === 'burned') slot.burned = true
  else slot.rotation = c
  log(x, owner(x, slot), `${slotName(x, slot)} is now ${c[0].toUpperCase() + c.slice(1)}.`)
  return true
}

export function removeConditions(x: X, slot: Slot): void {
  slot.rotation = null
  slot.poisoned = false
  slot.burned = false
  log(x, owner(x, slot), `${slotName(x, slot)} recovers from all Special Conditions.`)
}

/** Puts damage counters (not damage) on a Pokémon. Returns how many landed. */
export function placeCounters(x: X, slot: Slot, n: number): number {
  if (n <= 0 || !reaches(x, slot, 'counters') || !reaches(x, slot)) return 0
  slot.damage += n * 10
  log(x, owner(x, slot), `${slotName(x, slot)} gets ${n} damage counter${n === 1 ? '' : 's'}.`)
  return n
}

/** "Put n damage counters on … in any way you like." */
export function* distributeCounters(x: X, title: string, options: Slot[], n: number): Proc {
  for (const [slot, k] of yield* distribute(x, title, options, n)) placeCounters(x, slot, k)
}

export function moveCounters(x: X, from: Slot, to: Slot, n: number): number {
  if (!canMoveCounters(x)) return 0
  const k = Math.min(n, from.damage / 10)
  if (k <= 0 || (owner(x, to) !== x.me && !reaches(x, to, 'counters'))) return 0
  from.damage -= k * 10
  to.damage += k * 10
  log(x, x.me, `Moves ${k} damage counter${k === 1 ? '' : 's'} from ${slotName(x, from)} to ${slotName(x, to)}.`)
  return k
}

/** Knocks a Pokémon Out directly; the Knock Out resolves when the effect finishes. */
export function knockOut(x: X, slot: Slot): void {
  slot.damage = Math.max(slot.damage, maxHp(x, slot))
}

/** Switches a player's Active with a Benched Pokémon chosen by `chooser`. */
export function* switchIn(x: X, p: PlayerId, chooser: PlayerId, title: string, options = x.s.players[p].bench): Proc<Slot | null> {
  if (!x.s.players[p].active) return null
  const slot = yield* chooseOne(x, title, options, chooser)
  if (!slot) return null
  switchActive(x, p, slot.id)
  log(x, p, `${slotName(x, slot)} is now Active.`)
  return slot
}

/** Switch your Active Pokémon with 1 of your Benched Pokémon. */
export const switchOwn = (x: X, options?: Slot[]) => switchIn(x, x.me, x.me, 'Choose your new Active Pokémon', options)

/** Switch in 1 of your opponent's Benched Pokémon to the Active Spot. */
export const gust = (x: X, options?: Slot[]) => switchIn(x, x.opp, x.me, 'Choose the opponent\'s new Active Pokémon', options)

/** Switch out your opponent's Active Pokémon; your opponent chooses the new one. */
export const pushOut = (x: X) => switchIn(x, x.opp, x.opp, 'Choose your new Active Pokémon')

/** Moves an attached Energy card to another Pokémon. */
export function moveEnergy(x: X, uid: number, to: Slot): void {
  takeCard(x, uid)
  to.energy.push(uid)
  log(x, owner(x, to), `Moves ${nameOf(x, uid)} to ${slotName(x, to)}.`)
}

/** Attaches an Energy card from wherever it is. */
export function* attachEnergy(x: X, uid: number, to: Slot): Proc {
  const p = ownerOf(x, uid)
  const fromHand = x.s.players[p].hand.includes(uid)
  takeCard(x, uid)
  to.energy.push(uid)
  log(x, owner(x, to), `Attaches ${nameOf(x, uid)} to ${slotName(x, to)}.`)
  yield* emit(x, { type: 'attached', slot: to, card: uid, player: p, fromHand })
}

/**
 * Discards attached cards. From an attack, emits discardedByAttack first,
 * while the cards are still attached (Boomerang Energy remembers itself).
 */
export function* discardAttached(x: X, uids: number[]): Proc {
  if (!uids.length) return
  if (x.effect === 'attack') yield* emit(x, { type: 'discardedByAttack', cards: uids, attacker: (x as AttackX).attacker })
  moveCards(x, uids, 'discard')
  log(x, null, `Discards ${uids.map(u => nameOf(x, u)).join(', ')}.`)
}

/** Choose n Energy attached to a Pokémon and discard them. */
export function* discardEnergy(x: X, slot: Slot, o: { n: number; filter?: CardFilter; chooser?: PlayerId; title?: string; upTo?: boolean }): Proc<number[]> {
  if (owner(x, slot) !== x.me && !reaches(x, slot)) return []
  const options = o.filter ? matching(x, slot.energy, o.filter) : [...slot.energy]
  const picks = yield* chooseCards(x, { title: o.title ?? `Discard ${o.n} Energy`, options, min: o.upTo ? 0 : o.n, max: o.n, player: o.chooser ?? x.me })
  yield* discardAttached(x, picks)
  return picks
}

export function* discardAllEnergy(x: X, slot: Slot): Proc<number[]> {
  const all = [...slot.energy]
  yield* discardAttached(x, all)
  return all
}

/** Devolves a Pokémon: the top n evolution cards go to its owner's hand. */
export function devolve(x: X, slot: Slot, n = slot.stack.length - 1): number[] {
  const k = Math.min(n, slot.stack.length - 1)
  const removed = slot.stack.splice(slot.stack.length - k, k)
  x.s.players[owner(x, slot)].hand.push(...removed)
  slot.rotation = null
  slot.poisoned = false
  slot.burned = false
  slot.evolvedTurn = x.s.turn
  x.s.markers = x.s.markers.filter(m => m.slot !== slot.id || m.sticky)
  return removed
}

/** Evolves a Pokémon with a card from anywhere (deck, hand). */
export function* evolveWith(x: X, slot: Slot, uid: number): Proc {
  const p = owner(x, slot)
  const fromHand = x.s.players[p].hand.includes(uid)
  const from = slotName(x, slot)
  takeCard(x, uid)
  evolveSlot(x, slot, uid)
  log(x, p, `Evolves ${from} into ${nameOf(x, uid)}.`)
  yield* emit(x, { type: 'evolved', slot, player: p, fromHand })
}

/** Removes a Pokémon from play, sending every card in it somewhere (hand / deck). */
export function* removePokemon(x: X, slot: Slot, to: 'hand' | 'deck'): Proc {
  const p = owner(x, slot)
  const pl = x.s.players[p]
  const wasActive = pl.active?.id === slot.id
  const cards = slotCards(slot)
  if (wasActive) pl.active = null
  else pl.bench = pl.bench.filter(b => b.id !== slot.id)
  x.s.markers = x.s.markers.filter(m => m.slot !== slot.id)
  if (to === 'hand') pl.hand.push(...cards)
  else {
    pl.deck.push(...cards)
    shuffleDeck(x, p)
  }
  log(x, p, `${nameOf(x, slot.stack[slot.stack.length - 1])} and all attached cards go to the ${to}.`)
  if (wasActive && pl.bench.length) {
    const slot = yield* chooseOne(x, 'Choose your new Active Pokémon', pl.bench, p)
    if (slot) promote(x, p, slot.id)
  }
}

export function discardPokemon(x: X, slot: Slot): void {
  discardSlot(x, slot)
}

export function* discardStadium(x: X): Proc {
  const uid = x.s.stadium
  if (uid === null) return
  x.s.stadium = null
  x.s.players[ownerOf(x, uid)].discard.push(uid)
  log(x, x.me, `Discards ${nameOf(x, uid)}.`)
  yield* leaveHandlers(x, uid)
}

// ── attacks ──────────────────────────────────────────────────────────────

/** Attack damage to a Pokémon (Weakness and Resistance only on the opponent's Active). */
export function damage(a: AttackX, target: Slot, amount: number, opts?: DamageOptions): number {
  return hit(a, target, amount, opts)
}

/** The attack's damage to the Defending Pokémon. */
export function damageActive(a: AttackX, amount: number, opts?: DamageOptions): number {
  const d = a.s.players[a.opp].active
  return d ? hit(a, d, amount, opts) : 0
}

/** "This Pokémon also does n damage to itself." */
export function selfDamage(a: AttackX, n: number): void {
  a.attacker.damage += n
  log(a, a.me, `${slotName(a, a.attacker)} does ${n} damage to itself.`)
}

/** Uses another card's attack as this attack (copy attacks). */
export function* useAttackOf(a: AttackX, cardId: string, attack: CatalogAttack): Proc {
  log(a, a.me, `Uses ${attack.name}.`)
  const copy: AttackX = { ...a, attack, base: Number(/^(\d+)/.exec(attack.damage)?.[1] ?? 0) }
  yield* runAttack(a, a.attacker, cardId, attack, copy)
}

// ── markers ──────────────────────────────────────────────────────────────

export type Until = 'thisTurn' | 'opponentsNextTurn' | 'myNextTurn'

/** Leaves a timed effect. Markers on a Pokémon end when it moves to the Bench or evolves unless sticky. */
export function addMarker(x: X, kind: string, o: { until: Until; slot?: Slot; sticky?: boolean; data?: Marker['data'] }): Marker {
  const s = x.s
  const until = s.turn + (o.until === 'thisTurn' ? 0 : o.until === 'opponentsNextTurn' ? 1 : 2)
  const m: Marker = { id: s.nextMarkerId++, kind, player: x.me, until, ...(o.slot ? { slot: o.slot.id } : {}), ...(o.sticky ? { sticky: true } : {}), ...(o.data ? { data: o.data } : {}) }
  s.markers.push(m)
  return m
}

/** Markers of a kind, optionally on one Pokémon. */
export function markers(x: { s: X['s'] }, kind: string, slot?: Slot): Marker[] {
  return x.s.markers.filter(m => m.kind === kind && (!slot || m.slot === slot.id))
}

/** Is a marker of this kind active now? Markers start working on the turn after they are made unless `now`. */
export function markerActive(x: { s: X['s'] }, m: Marker): boolean {
  return x.s.turn <= m.until
}

// ── misc ─────────────────────────────────────────────────────────────────

/** Ends the turn after this effect (Lumiose City). */
export function endTheTurn(x: X): void {
  x.endsTurn = true
}

export function opponent(x: X): PlayerId {
  return other(x.me)
}

export function nameOfCard(x: X, uid: number): string {
  return cardOf(x, uid).name
}

/** Uses a once-per-game effect; false if already used. */
export function useOnce(x: { s: X['s'] }, key: string): boolean {
  if (x.s.usedOnce.includes(key)) return false
  x.s.usedOnce.push(key)
  return true
}

