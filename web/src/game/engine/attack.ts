import type { CatalogAttack } from '../catalog/types'
import { emit } from './events'
import type { AttackImpl, AttackX, DamageEvent } from './impl'
import { allowed, cardImpl, each } from './modifiers'
import { ask } from './prompt'
import { coin } from './rng'
import {
  attackCost, baseDamage, canPay, log, maxHp, other, slotName, slotOwner, thisTurn, topCard,
  usableAttacks, weaknessOf,
} from './rules'
import { endTurn, isOver, resolveKnockOuts } from './turn'
import type { Ctx, Proc, Slot } from './types'

export type DamageOptions = Pick<DamageEvent, 'ignoreWeakness' | 'ignoreResistance' | 'ignoreDefenderEffects'>

/**
 * Damage an attack does to one Pokémon:
 *   base → + attacker bonuses (before Weakness and Resistance)
 *        → ×Weakness → −Resistance (opponent's Active only)
 *        → − reductions (after Weakness and Resistance) → prevention.
 * With ignoreDefenderEffects, modifiers on the target itself are skipped.
 */
export function attackDamage(ctx: Ctx, ev: DamageEvent, base: number): number {
  if (base <= 0) return 0
  const skip = ev.ignoreDefenderEffects ? ev.target : undefined
  let dmg = base
  for (const [src, f] of each(ctx, 'damageDealt', skip)) dmg += f(src, ctx, ev)
  if (ev.toActive) {
    const types = topCard(ctx, ev.attacker).types ?? []
    const w = weaknessOf(ctx, ev.target)
    if (!ev.ignoreWeakness && w && types.includes(w.type)) dmg *= Number(/(\d+)/.exec(w.value)?.[1] ?? 2)
    const r = topCard(ctx, ev.target).resistance
    if (!ev.ignoreResistance && r && types.includes(r.type)) dmg -= Number(/(\d+)/.exec(r.value)?.[1] ?? 30)
  }
  for (const [src, f] of each(ctx, 'damageTaken', skip)) dmg -= f(src, ctx, ev)
  dmg = Math.max(0, dmg)
  if (dmg && each(ctx, 'preventDamage', skip).some(([src, f]) => f(src, ctx, ev))) return 0
  return dmg
}

/** Does attack damage to a Pokémon and records the hit. Returns the damage done. */
export function hit(a: AttackX, target: Slot, amount: number, opts: DamageOptions = {}): number {
  const ctx: Ctx = a
  const opp = ctx.s.players[slotOwner(ctx, target)]
  const ev: DamageEvent = {
    attacker: a.attacker, target, attack: a.attack,
    toActive: opp.active?.id === target.id && slotOwner(ctx, target) !== a.me, ...opts,
  }
  const dmg = attackDamage(ctx, ev, amount)
  if (!dmg) return 0
  const before = target.damage
  const hp = maxHp(ctx, target)
  if (before + dmg >= hp && each(ctx, 'survive').some(([src, f]) => f(src, ctx, ev, before))) {
    target.damage = Math.max(before, hp - 10)
    log(ctx, slotOwner(ctx, target), `${slotName(ctx, target)} isn't Knocked Out: its remaining HP becomes 10.`)
  } else {
    target.damage += dmg
    log(ctx, slotOwner(ctx, target), `${slotName(ctx, target)} takes ${dmg} damage.`)
  }
  if (slotOwner(ctx, target) !== a.me) {
    target.hitBy = { turn: ctx.s.turn, player: a.me }
    a.hits.push({ target, damage: dmg })
  }
  return dmg
}

export function attackX(ctx: Ctx, attacker: Slot, attack: CatalogAttack): AttackX {
  const me = slotOwner(ctx, attacker)
  return {
    s: ctx.s, db: ctx.db, me, opp: other(me), self: attacker, card: attacker.stack[attacker.stack.length - 1],
    effect: 'attack', attacker, defender: ctx.s.players[other(me)].active, attack, base: baseDamage(attack), hits: [],
  }
}

export function attackImpl(ctx: Ctx, cardId: string, name: string): AttackImpl | undefined {
  const impl = cardImpl(ctx, cardId)?.attacks?.[name]
  return typeof impl === 'function' ? { run: impl } : impl
}

/** Runs an attack's effect (or its printed damage) as this Pokémon: also how copied attacks run. */
export function* runAttack(ctx: Ctx, attacker: Slot, cardId: string, attack: CatalogAttack, a = attackX(ctx, attacker, attack)): Proc {
  const run = attackImpl(ctx, cardId, attack.name)?.run
  if (run) yield* run(a)
  else if (a.defender && a.base) hit(a, a.defender, a.base)
}

/** Can this Pokémon use this attack now (cost, locks, the attack's own requirement)? */
export function attackUsable(ctx: Ctx, slot: Slot, cardId: string, attack: CatalogAttack): boolean {
  if (!canPay(ctx, slot, attackCost(ctx, slot, attack))) return false
  if (!allowed(ctx, 'canAttack', slot, attack)) return false
  const canUse = attackImpl(ctx, cardId, attack.name)?.canUse
  return !canUse || canUse(attackX(ctx, slot, attack))
}

/**
 * Uses an attack: Confusion, the attack, "damaged by an attack" triggers,
 * Knock Outs, a second attack if something grants one, then the turn ends.
 */
export function* useAttack(ctx: Ctx, attacker: Slot, cardId: string, attack: CatalogAttack): Proc {
  const knockedOut = yield* attackOnce(ctx, attacker, cardId, attack)
  const s = ctx.s
  if (isOver(s)) return

  const p = slotOwner(ctx, attacker)
  const again = s.players[p].active?.id === attacker.id &&
    each(ctx, 'attackAgain').some(([src, f]) => f(src, ctx, attacker, knockedOut))
  if (again) {
    const options = usableAttacks(ctx, attacker).filter(u => u.own && attackUsable(ctx, attacker, u.cardId, u.attack))
    if (options.length) {
      const [choice] = yield* ask({
        kind: 'chooseOption', player: p, title: 'Attack again?',
        options: ['Don\'t attack again', ...options.map(o => o.attack.name)],
      })
      if (choice > 0) {
        const o = options[choice - 1]
        yield* attackOnce(ctx, attacker, o.cardId, o.attack)
        if (isOver(s)) return
      }
    }
  }
  yield* endTurn(ctx)
}

/** One attack through Knock Outs. Returns whether the Defending Pokémon was Knocked Out. */
function* attackOnce(ctx: Ctx, attacker: Slot, cardId: string, attack: CatalogAttack): Proc<boolean> {
  const s = ctx.s
  const p = slotOwner(ctx, attacker)
  log(ctx, p, `${slotName(ctx, attacker)} uses ${attack.name}.`)
  thisTurn(ctx).attacks.push({ slot: attacker.id, name: attack.name })

  const a = attackX(ctx, attacker, attack)
  let fails = false
  if (attacker.rotation === 'confused') {
    const heads = coin(s)
    log(ctx, p, `Confused: flip ${heads ? 'heads' : 'tails: the attack fails and it puts 3 damage counters on itself'}.`)
    if (!heads) {
      attacker.damage += 30
      fails = true
    }
  }
  if (!fails) yield* runAttack(ctx, attacker, cardId, attack, a)

  for (const h of a.hits) yield* emit(ctx, { type: 'damagedByAttack', target: h.target, attacker, damage: h.damage })
  yield* emit(ctx, { type: 'attackDone', attacker })

  const defenderId = a.defender?.id
  yield* resolveKnockOuts(ctx, true)
  return thisTurn(ctx).knockOuts.some(k => k.slot === defenderId)
}
