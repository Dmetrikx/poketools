import { attackUsable, useAttack } from './attack'
import { emit } from './events'
import type { AbilityImpl, X } from './impl'
import { applyJudge } from './judge'
import { abilityImpl, abilityOff, allowed, each, implOf } from './modifiers'
import { ask } from './prompt'
import {
  benchLimit, canPlayCard, canRetreatNow, cardOf, clearConditions, discardSlot, energyAmount, inPlay,
  isBasicPokemon, isFirstTurn, leftActive, log, nameOf, newSlot, other, ownerOf, retreatCost, slotName,
  switchActive, takeFromZone, thisTurn, topCard, usableAttacks,
} from './rules'
import { endGame, endTurn, isOver, resolveKnockOuts, setup } from './turn'
import type { Action, Ctx, PlayerId, Proc, Slot } from './types'

/** A stable string form of an action, for comparing against legalActions. */
export function actionKey(a: Action): string {
  const sorted = (v: unknown): unknown =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted((v as Record<string, unknown>)[k])]))
      : v
  return JSON.stringify(sorted(a))
}

/** The context a card played or used by the turn player runs in. */
export function playerX(ctx: Ctx, p: PlayerId, effect: X['effect'], card: number | null, self: Slot | null = null): X {
  return { s: ctx.s, db: ctx.db, me: p, opp: other(p), self, card, effect }
}

// ── what the turn player may do ──────────────────────────────────────────

/**
 * Every legal action in the current state, except judge overrides (always
 * allowed while no prompt is pending) and concede (always allowed while
 * the game runs). While a prompt is pending, the only move is answering it.
 */
export function legalActions(ctx: Ctx): Action[] {
  const s = ctx.s
  if (s.phase === 'setup') return s.log.length ? [] : [{ type: 'start' }]
  if (isOver(s) || s.pendingPrompt) return []

  const p = s.turnPlayer
  const pl = s.players[p]
  const out: Action[] = []
  const slots = inPlay(pl)

  for (const uid of pl.hand) {
    const c = cardOf(ctx, uid)
    if (!canPlayCard(ctx, p, uid)) continue
    if (c.kind === 'pokemon') {
      if (isBasicPokemon(c)) {
        if (pl.bench.length < benchLimit(ctx, p)) out.push({ type: 'playBasic', card: uid })
      } else {
        for (const slot of slots) if (canEvolve(ctx, p, slot, uid)) out.push({ type: 'evolve', card: uid, target: slot.id })
      }
    } else if (c.kind === 'energy') {
      if (pl.flags.energyAttached) continue
      for (const slot of slots) if (canAttachEnergy(ctx, p, uid, slot)) out.push({ type: 'attachEnergy', card: uid, target: slot.id })
    } else if (c.subtype === 'Tool') {
      const can = implOf(ctx, uid)?.trainer?.canAttach
      for (const slot of slots) {
        if (slot.tools.length === 0 && (!can || can(playerX(ctx, p, 'trainer', uid), slot))) out.push({ type: 'playTrainer', card: uid, target: slot.id })
      }
    } else if (c.subtype === 'Stadium') {
      const current = s.stadium === null ? null : nameOf(ctx, s.stadium)
      if (!pl.flags.stadiumPlayed && current !== c.name) out.push({ type: 'playTrainer', card: uid })
    } else if (canPlayEffectTrainer(ctx, p, uid)) {
      out.push({ type: 'playTrainer', card: uid })
    }
  }

  for (const slot of slots) {
    for (const a of topCard(ctx, slot).abilities ?? []) {
      if (canUseAbility(ctx, p, slot, slot.stack[slot.stack.length - 1], a.name)) out.push({ type: 'useAbility', source: slot.id, ability: a.name })
    }
  }
  for (const uid of pl.hand) {
    for (const a of cardOf(ctx, uid).abilities ?? []) {
      if (canUseAbility(ctx, p, null, uid, a.name)) out.push({ type: 'useAbility', source: uid, ability: a.name })
    }
  }

  if (canUseStadium(ctx, p)) out.push({ type: 'stadiumAction' })

  if (pl.active && !pl.flags.retreated && pl.bench.length && canAct(pl.active) && canRetreatNow(ctx, pl.active)) {
    for (const discard of retreatPayments(ctx, pl.active)) {
      for (const b of pl.bench) out.push({ type: 'retreat', to: b.id, discard })
    }
  }

  if (pl.active && canAttackThisTurn(ctx, p) && canAct(pl.active)) {
    for (const u of usableAttacks(ctx, pl.active)) {
      if (attackUsable(ctx, pl.active, u.cardId, u.attack)) {
        out.push(u.own ? { type: 'attack', attack: u.attack.name } : { type: 'attack', attack: u.attack.name, source: u.cardId })
      }
    }
  }

  out.push({ type: 'endTurn' })
  return out
}

/** Asleep and Paralyzed Pokémon can't retreat or attack. */
function canAct(slot: Slot): boolean {
  return slot.rotation !== 'asleep' && slot.rotation !== 'paralyzed'
}

/** The player going first can't attack on their first turn. */
export function canAttackThisTurn(ctx: Ctx, p: PlayerId): boolean {
  return !(p === ctx.s.firstPlayer && isFirstTurn(ctx, p))
}

export function canEvolve(ctx: Ctx, p: PlayerId, slot: Slot, uid: number): boolean {
  const s = ctx.s
  const c = cardOf(ctx, uid)
  if (c.kind !== 'pokemon' || c.subtype === 'Basic') return false
  if (isFirstTurn(ctx, p)) return false
  const nameOk = c.evolveFrom === slotName(ctx, slot) || each(ctx, 'evolvesFrom').some(([src, f]) => f(src, ctx, slot, uid))
  if (!nameOk) return false
  if (slot.evolvedTurn >= s.turn) return false
  if (slot.enteredTurn >= s.turn && !each(ctx, 'evolveSameTurn').some(([src, f]) => f(src, ctx, slot, uid))) return false
  return true
}

function canAttachEnergy(ctx: Ctx, p: PlayerId, uid: number, slot: Slot): boolean {
  const can = implOf(ctx, uid)?.energy?.canAttach
  return !can || can(playerX(ctx, p, 'energy', uid), slot)
}

/** Items and Supporters: playable once their effect exists and its conditions hold. */
function canPlayEffectTrainer(ctx: Ctx, p: PlayerId, uid: number): boolean {
  const c = cardOf(ctx, uid)
  const impl = implOf(ctx, uid)?.trainer
  if (!impl?.play) return false
  if (c.subtype === 'Supporter') {
    if (ctx.s.players[p].flags.supporterPlayed) return false
    if (p === ctx.s.firstPlayer && isFirstTurn(ctx, p) && !impl.firstTurn) return false
  }
  return !impl.canPlay || impl.canPlay(playerX(ctx, p, 'trainer', uid))
}

/** An activated ability: in play (slot) or from the hand (slot null). */
function canUseAbility(ctx: Ctx, p: PlayerId, slot: Slot | null, uid: number, name: string): boolean {
  const impl: AbilityImpl | undefined = abilityImpl(ctx, ctx.s.cards[uid].cardId, name)
  if (!impl?.use) return false
  if (!!impl.fromHand !== !slot) return false
  if (slot && abilityOff(ctx, slot, name)) return false
  const uses = thisTurn(ctx).abilities
  const id = slot ? slot.id : uid
  if ((impl.limit ?? 'once') === 'once' && uses.some(u => u.slot === id && u.name === name)) return false
  if (impl.group && uses.some(u => u.group === impl.group)) return false
  return !impl.canUse || impl.canUse(playerX(ctx, p, 'ability', uid, slot))
}

function canUseStadium(ctx: Ctx, p: PlayerId): boolean {
  const s = ctx.s
  if (s.stadium === null || thisTurn(ctx).stadiumUsed) return false
  const action = implOf(ctx, s.stadium)?.trainer?.action
  if (!action) return false
  return !action.canUse || action.canUse(playerX(ctx, p, 'stadium', s.stadium))
}

/**
 * Sets of attached Energy that pay the Retreat Cost with nothing left over:
 * every card counts, and dropping any one would leave the cost unpaid.
 */
export function retreatPayments(ctx: Ctx, slot: Slot): number[][] {
  const cost = retreatCost(ctx, slot)
  if (cost <= 0) return [[]]
  const energy = slot.energy
  const amounts = energy.map(uid => energyAmount(ctx, slot, uid))
  const out: number[][] = []
  for (let mask = 1; mask < 1 << energy.length; mask++) {
    let sum = 0
    let min = Infinity
    for (let i = 0; i < energy.length; i++) if (mask & (1 << i)) { sum += amounts[i]; min = Math.min(min, amounts[i]) }
    if (sum >= cost && sum - min < cost) out.push(energy.filter((_, i) => mask & (1 << i)))
  }
  return out
}

// ── doing it ─────────────────────────────────────────────────────────────

export function* perform(ctx: Ctx, action: Action): Proc {
  const s = ctx.s
  if (action.type === 'concede') {
    if (isOver(s)) throw new Error('the game is over')
    log(ctx, action.player, 'Concedes.')
    return endGame(ctx, other(action.player))
  }
  if (action.type === 'judge') {
    if (s.phase !== 'main') throw new Error('judge actions need a game in progress')
    yield* applyJudge(ctx, action.judge)
    return yield* stateChecks(ctx)
  }
  const legal = new Set(legalActions(ctx).map(actionKey))
  if (!legal.has(actionKey(action))) throw new Error(`illegal action: ${actionKey(action)}`)

  if (action.type === 'start') return yield* setup(ctx)
  if (action.type === 'attack') return yield* attackAction(ctx, action.attack, action.source)
  if (action.type === 'endTurn') {
    log(ctx, s.turnPlayer, 'Ends the turn.')
    return yield* endTurn(ctx)
  }
  const endsTurn = yield* mainAction(ctx, action)
  if (isOver(s)) return
  yield* stateChecks(ctx)
  if (isOver(s)) return
  if (endsTurn) {
    log(ctx, s.turnPlayer, 'The turn ends.')
    yield* endTurn(ctx)
  }
}

function* attackAction(ctx: Ctx, name: string, source?: string): Proc {
  const active = ctx.s.players[ctx.s.turnPlayer].active!
  const u = usableAttacks(ctx, active).find(x => x.attack.name === name && (source ? x.cardId === source : x.own))!
  yield* useAttack(ctx, active, u.cardId, u.attack)
}

/** Everything but start, attack, end turn, concede and judge. Returns whether the turn ends. */
function* mainAction(ctx: Ctx, action: Action): Proc<boolean> {
  const s = ctx.s
  const p = s.turnPlayer
  const pl = s.players[p]
  switch (action.type) {
    case 'playBasic': {
      takeFromZone(pl.hand, action.card)
      const slot = newSlot(action.card, s.turn)
      pl.bench.push(slot)
      log(ctx, p, `Plays ${nameOf(ctx, action.card)} onto the Bench.`)
      yield* emit(ctx, { type: 'playedToBench', slot, player: p, fromHand: true })
      return false
    }

    case 'evolve': {
      const slot = inPlay(pl).find(x => x.id === action.target)!
      const from = slotName(ctx, slot)
      takeFromZone(pl.hand, action.card)
      evolveSlot(ctx, slot, action.card)
      log(ctx, p, `Evolves ${from} into ${nameOf(ctx, action.card)}.`)
      yield* emit(ctx, { type: 'evolved', slot, player: p, fromHand: true })
      return false
    }

    case 'attachEnergy': {
      const slot = inPlay(pl).find(x => x.id === action.target)!
      takeFromZone(pl.hand, action.card)
      slot.energy.push(action.card)
      pl.flags.energyAttached = true
      log(ctx, p, `Attaches ${nameOf(ctx, action.card)} to ${slotName(ctx, slot)}.`)
      yield* emit(ctx, { type: 'attached', slot, card: action.card, player: p, fromHand: true })
      return false
    }

    case 'playTrainer':
      return yield* playTrainer(ctx, p, action.card, action.target)

    case 'useAbility': {
      const fromHand = pl.hand.includes(action.source)
      const slot = fromHand ? null : inPlay(pl).find(x => x.id === action.source)!
      const uid = slot ? slot.stack[slot.stack.length - 1] : action.source
      const impl = abilityImpl(ctx, s.cards[uid].cardId, action.ability)!
      thisTurn(ctx).abilities.push({ slot: action.source, name: action.ability, group: impl.group })
      log(ctx, p, `${slot ? slotName(ctx, slot) : nameOf(ctx, uid)} uses ${action.ability}.`)
      const x = playerX(ctx, p, 'ability', uid, slot)
      yield* impl.use!(x)
      return !!x.endsTurn
    }

    case 'stadiumAction': {
      const uid = s.stadium!
      thisTurn(ctx).stadiumUsed = true
      log(ctx, p, `Uses ${nameOf(ctx, uid)}.`)
      const x = playerX(ctx, p, 'stadium', uid)
      yield* implOf(ctx, uid)!.trainer!.action!.run(x)
      return !!x.endsTurn
    }

    case 'retreat': {
      const active = pl.active!
      const name = slotName(ctx, active)
      for (const uid of action.discard) {
        takeFromZone(active.energy, uid)
        pl.discard.push(uid)
      }
      switchActive(ctx, p, action.to)
      pl.flags.retreated = true
      log(ctx, p, `Retreats ${name}; ${slotName(ctx, pl.active!)} is now Active.`)
      return false
    }

    default:
      throw new Error(`unexpected action ${action.type}`)
  }
}

/** Puts an evolution card on a Pokémon: conditions and effects on it end. */
export function evolveSlot(ctx: Ctx, slot: Slot, uid: number): void {
  slot.stack.push(uid)
  slot.evolvedTurn = ctx.s.turn
  clearConditions(slot)
  leftActive(ctx, slot)
}

function* playTrainer(ctx: Ctx, p: PlayerId, uid: number, target?: number): Proc<boolean> {
  const s = ctx.s
  const pl = s.players[p]
  const c = cardOf(ctx, uid)
  takeFromZone(pl.hand, uid)

  if (c.subtype === 'Tool') {
    const slot = inPlay(pl).find(x => x.id === target)!
    slot.tools.push(uid)
    log(ctx, p, `Attaches ${c.name} to ${slotName(ctx, slot)}.`)
    return false
  }

  if (c.subtype === 'Stadium') {
    const old = s.stadium
    s.stadium = uid
    pl.flags.stadiumPlayed = true
    log(ctx, p, `Plays ${c.name}.`)
    if (old !== null) {
      s.players[ownerOf(ctx, old)].discard.push(old)
      yield* leaveHandlers(ctx, old)
    }
    return false
  }

  // Item or Supporter: out of the hand while it resolves, then discarded.
  s.resolving.push(uid)
  if (c.subtype === 'Supporter') {
    pl.flags.supporterPlayed = true
    thisTurn(ctx).supporters.push(c.name)
  }
  log(ctx, p, `Plays ${c.name}.`)
  const x = playerX(ctx, p, 'trainer', uid)
  yield* implOf(ctx, uid)!.trainer!.play!(x)
  const i = s.resolving.indexOf(uid)
  if (i >= 0) {
    s.resolving.splice(i, 1)
    pl.discard.push(uid)
  }
  return !!x.endsTurn
}

/** A Stadium leaving play runs its own leftPlay handler (it is no longer a source), then everyone else's. */
export function* leaveHandlers(ctx: Ctx, uid: number): Proc {
  const fn = implOf(ctx, uid)?.trainer?.on?.leftPlay
  if (fn) {
    const r = fn(playerX(ctx, ownerOf(ctx, uid), 'stadium', uid), { type: 'leftPlay', card: uid })
    if (r) yield* r
  }
  yield* emit(ctx, { type: 'leftPlay', card: uid })
}

/**
 * Rules that hold after every action: Special Conditions a Pokémon can't
 * have come off, Energy that can't stay attached is discarded, a Bench over
 * its limit is cut down, and Knock Outs resolve.
 */
export function* stateChecks(ctx: Ctx): Proc {
  const s = ctx.s
  for (const p of [0, 1] as PlayerId[]) {
    for (const slot of inPlay(s.players[p])) {
      if (slot.rotation && !allowed(ctx, 'canHaveCondition', slot, slot.rotation)) slot.rotation = null
      if (slot.poisoned && !allowed(ctx, 'canHaveCondition', slot, 'poisoned')) slot.poisoned = false
      if (slot.burned && !allowed(ctx, 'canHaveCondition', slot, 'burned')) slot.burned = false
      for (const uid of [...slot.energy]) {
        const can = implOf(ctx, uid)?.energy?.canAttach
        if (can && !can(playerX(ctx, p, 'energy', uid), slot)) {
          takeFromZone(slot.energy, uid)
          s.players[p].discard.push(uid)
          log(ctx, p, `${nameOf(ctx, uid)} is discarded.`)
        }
      }
    }
  }
  for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
    const pl = s.players[p]
    const excess = pl.bench.length - benchLimit(ctx, p)
    if (excess <= 0) continue
    const picks = yield* ask({ kind: 'choosePokemon', player: p, title: `Discard ${excess} Benched Pokémon`, options: pl.bench.map(b => b.id), min: excess, max: excess })
    for (const id of picks) discardSlot(ctx, pl.bench.find(b => b.id === id)!)
  }
  yield* resolveKnockOuts(ctx)
}
