import { useAttack } from './attack'
import { applyJudge } from './judge'
import {
  attackCost, attacksOf, benchLimit, canPay, cardOf, energyAmount, inPlay, isBasicPokemon, isFirstTurn,
  log, nameOf, newSlot, clearConditions, other, retreatCost, slotName, switchActive, takeFromZone,
} from './rules'
import { endGame, endTurn, setup } from './turn'
import type { Action, Ctx, PlayerId, Proc, Slot } from './types'

/** A stable string form of an action, for comparing against legalActions. */
export function actionKey(a: Action): string {
  return JSON.stringify(a, Object.keys(a).sort())
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
  if (s.phase === 'over' || s.pendingPrompt) return []

  const p = s.turnPlayer
  const pl = s.players[p]
  const out: Action[] = []
  const slots = inPlay(pl)

  for (const uid of pl.hand) {
    const c = cardOf(ctx, uid)
    if (c.kind === 'pokemon') {
      if (isBasicPokemon(c)) {
        if (pl.bench.length < benchLimit(ctx, p)) out.push({ type: 'playBasic', card: uid })
      } else {
        for (const slot of slots) if (canEvolve(ctx, p, slot, uid)) out.push({ type: 'evolve', card: uid, target: slot.id })
      }
    } else if (c.kind === 'energy') {
      if (!pl.flags.energyAttached) for (const slot of slots) out.push({ type: 'attachEnergy', card: uid, target: slot.id })
    } else if (c.subtype === 'Tool') {
      for (const slot of slots) if (slot.tools.length === 0) out.push({ type: 'playTrainer', card: uid, target: slot.id })
    } else if (c.subtype === 'Stadium') {
      const current = s.stadium === null ? null : nameOf(ctx, s.stadium)
      if (!pl.flags.stadiumPlayed && current !== c.name) out.push({ type: 'playTrainer', card: uid })
    }
    // Items and Supporters need their effect (milestone 6).
  }

  if (pl.active && !pl.flags.retreated && pl.bench.length && canAct(pl.active)) {
    for (const discard of retreatPayments(ctx, pl.active)) {
      for (const b of pl.bench) out.push({ type: 'retreat', to: b.id, discard })
    }
  }

  if (pl.active && canAttackThisTurn(ctx, p) && canAct(pl.active)) {
    for (const a of attacksOf(ctx, pl.active)) {
      if (canPay(ctx, pl.active, attackCost(ctx, pl.active, a))) out.push({ type: 'attack', attack: a.name })
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
  if (slot.enteredTurn >= s.turn || slot.evolvedTurn >= s.turn) return false
  return c.evolveFrom === slotName(ctx, slot)
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
    if (s.phase === 'over') throw new Error('the game is over')
    log(ctx, action.player, 'Concedes.')
    return endGame(ctx, other(action.player))
  }
  if (action.type === 'judge') {
    if (s.phase !== 'main') throw new Error('judge actions need a game in progress')
    return yield* applyJudge(ctx, action.judge)
  }
  const legal = new Set(legalActions(ctx).map(actionKey))
  if (!legal.has(actionKey(action))) throw new Error(`illegal action: ${actionKey(action)}`)

  const p = s.turnPlayer
  const pl = s.players[p]
  switch (action.type) {
    case 'start':
      return yield* setup(ctx)

    case 'playBasic': {
      takeFromZone(pl.hand, action.card)
      pl.bench.push(newSlot(action.card, s.turn))
      log(ctx, p, `Plays ${nameOf(ctx, action.card)} onto the Bench.`)
      return
    }

    case 'evolve': {
      const slot = inPlay(pl).find(x => x.id === action.target)!
      const from = slotName(ctx, slot)
      takeFromZone(pl.hand, action.card)
      slot.stack.push(action.card)
      slot.evolvedTurn = s.turn
      clearConditions(slot)
      log(ctx, p, `Evolves ${from} into ${nameOf(ctx, action.card)}.`)
      return
    }

    case 'attachEnergy': {
      const slot = inPlay(pl).find(x => x.id === action.target)!
      takeFromZone(pl.hand, action.card)
      slot.energy.push(action.card)
      pl.flags.energyAttached = true
      log(ctx, p, `Attaches ${nameOf(ctx, action.card)} to ${slotName(ctx, slot)}.`)
      return
    }

    case 'playTrainer': {
      const c = cardOf(ctx, action.card)
      takeFromZone(pl.hand, action.card)
      if (c.subtype === 'Tool') {
        const slot = inPlay(pl).find(x => x.id === action.target)!
        slot.tools.push(action.card)
        log(ctx, p, `Attaches ${c.name} to ${slotName(ctx, slot)}.`)
      } else if (c.subtype === 'Stadium') {
        if (s.stadium !== null) s.players[ctx.s.cards[s.stadium].owner].discard.push(s.stadium)
        s.stadium = action.card
        pl.flags.stadiumPlayed = true
        log(ctx, p, `Plays ${c.name}.`)
      }
      return
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
      return
    }

    case 'attack': {
      const active = pl.active!
      const attack = attacksOf(ctx, active).find(a => a.name === action.attack)!
      return yield* useAttack(ctx, active, attack)
    }

    case 'endTurn':
      log(ctx, p, 'Ends the turn.')
      return yield* endTurn(ctx)

    case 'useAbility':
      throw new Error('abilities arrive with the effect package')
  }
}

