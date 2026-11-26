import type { CatalogAttack } from '../catalog/types'
import { coin } from './rng'
import { baseDamage, log, other, slotName, slotOwner, topCard } from './rules'
import { endTurn, resolveKnockOuts } from './turn'
import type { Ctx, Proc, Slot } from './types'

export interface DamageOptions {
  /** Apply Weakness and Resistance (only ever to the opponent's Active). */
  weakness?: boolean
  resistance?: boolean
}

/**
 * Damage an attack does to one Pokémon. Base → Weakness (×2) → Resistance
 * (−30) for the opponent's Active; Benched Pokémon skip both. The effect
 * package adds attacker and defender modifiers and prevention around these
 * steps (milestone 4).
 */
export function attackDamage(ctx: Ctx, attacker: Slot, target: Slot, base: number, opts: DamageOptions = {}): number {
  const s = ctx.s
  const defender = slotOwner(ctx, target)
  const isDefendingActive = s.players[defender].active?.id === target.id && defender !== slotOwner(ctx, attacker)
  let dmg = base
  if (dmg <= 0) return 0
  if (isDefendingActive) {
    const types = topCard(ctx, attacker).types ?? []
    const card = topCard(ctx, target)
    if (opts.weakness !== false && card.weakness && types.includes(card.weakness.type)) {
      const m = /(\d+)/.exec(card.weakness.value)
      dmg *= m ? Number(m[1]) : 2
    }
    if (opts.resistance !== false && card.resistance && types.includes(card.resistance.type)) {
      const m = /(\d+)/.exec(card.resistance.value)
      dmg -= m ? Number(m[1]) : 30
    }
  }
  return Math.max(0, dmg)
}

export function dealDamage(ctx: Ctx, attacker: Slot, target: Slot, base: number, opts?: DamageOptions): number {
  const dmg = attackDamage(ctx, attacker, target, base, opts)
  target.damage += dmg
  if (dmg) log(ctx, slotOwner(ctx, target), `${slotName(ctx, target)} takes ${dmg} damage.`)
  return dmg
}

/**
 * Uses an attack: Confusion check, the attack's damage to the Defending
 * Pokémon, Knock Outs, then the turn ends. Effect text is the effect
 * package's job; here every attack does its printed damage.
 */
export function* useAttack(ctx: Ctx, attacker: Slot, attack: CatalogAttack): Proc {
  const s = ctx.s
  const p = slotOwner(ctx, attacker)
  log(ctx, p, `${slotName(ctx, attacker)} uses ${attack.name}.`)

  let fails = false
  if (attacker.rotation === 'confused') {
    const heads = coin(s)
    log(ctx, p, `Confused: flip ${heads ? 'heads' : 'tails: the attack fails and it puts 3 damage counters on itself'}.`)
    if (!heads) {
      attacker.damage += 30
      fails = true
    }
  }

  const defender = s.players[other(p)].active
  if (!fails && defender) {
    const base = baseDamage(attack)
    if (base) dealDamage(ctx, attacker, defender, base)
  }

  yield* resolveKnockOuts(ctx)
  if (s.phase === 'over') return
  yield* endTurn(ctx)
}
