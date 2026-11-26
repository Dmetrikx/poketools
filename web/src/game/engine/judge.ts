import {
  clearConditions, draw, findSlot, inPlay, log, nameOf, ownerOf, shuffleDeck, slotCards, slotName,
} from './rules'
import { resetFlags, resolveKnockOuts } from './turn'
import type { Ctx, JudgeOp, PlayerId, Proc } from './types'

/**
 * Manual overrides for mistakes. Logged and replayed like any action, so a
 * correction survives reload and undo.
 */
export function* applyJudge(ctx: Ctx, op: JudgeOp): Proc {
  const s = ctx.s
  switch (op.op) {
    case 'setDamage': {
      const f = findSlot(ctx, op.slot)
      if (!f || op.damage < 0 || op.damage % 10) throw new Error('setDamage: bad slot or amount')
      f.slot.damage = op.damage
      log(ctx, null, `Judge: ${slotName(ctx, f.slot)} now has ${op.damage} damage.`)
      return yield* resolveKnockOuts(ctx)
    }
    case 'setCondition': {
      const f = findSlot(ctx, op.slot)
      if (!f) throw new Error('setCondition: no such Pokémon')
      if (op.condition === 'none') clearConditions(f.slot)
      else if (op.condition === 'poisoned') f.slot.poisoned = true
      else if (op.condition === 'burned') f.slot.burned = true
      else f.slot.rotation = op.condition
      log(ctx, null, `Judge: ${slotName(ctx, f.slot)} ${op.condition === 'none' ? 'has no Special Conditions' : `is ${op.condition}`}.`)
      return
    }
    case 'moveCard': {
      const owner = ownerOf(ctx, op.uid)
      detach(ctx, op.uid)
      const pl = s.players[owner]
      if (op.to === 'hand') pl.hand.push(op.uid)
      else if (op.to === 'deckTop') pl.deck.unshift(op.uid)
      else if (op.to === 'deckBottom') pl.deck.push(op.uid)
      else if (op.to === 'discard') pl.discard.push(op.uid)
      else pl.prizes.push(op.uid)
      log(ctx, null, `Judge: ${nameOf(ctx, op.uid)} moved to ${op.to}.`)
      return yield* resolveKnockOuts(ctx)
    }
    case 'shuffleDeck':
      shuffleDeck(ctx, op.player)
      log(ctx, op.player, 'Judge: deck shuffled.')
      return
    case 'draw':
      draw(ctx, op.player, 1)
      log(ctx, op.player, 'Judge: draws a card.')
      return
    case 'resetFlags':
      resetFlags(ctx, op.player)
      log(ctx, op.player, 'Judge: this turn\'s once-per-turn actions reset.')
      return
  }
}

/**
 * Takes a card out of wherever it is. A Pokémon's only card takes the whole
 * Pokémon with it (attached cards go to the discard pile); the top card of
 * an evolved Pokémon devolves it.
 */
function detach(ctx: Ctx, uid: number): void {
  const s = ctx.s
  const owner = ownerOf(ctx, uid)
  const pl = s.players[owner]
  for (const zone of [pl.deck, pl.hand, pl.discard, pl.prizes]) {
    const i = zone.indexOf(uid)
    if (i >= 0) { zone.splice(i, 1); return }
  }
  if (s.stadium === uid) { s.stadium = null; return }
  for (const p of [0, 1] as PlayerId[]) {
    const holder = s.players[p]
    for (const slot of inPlay(holder)) {
      for (const list of [slot.energy, slot.tools]) {
        const i = list.indexOf(uid)
        if (i >= 0) { list.splice(i, 1); return }
      }
      const i = slot.stack.indexOf(uid)
      if (i < 0) continue
      if (slot.stack.length === 1) {
        if (holder.active?.id === slot.id) holder.active = null
        else holder.bench = holder.bench.filter(b => b.id !== slot.id)
        for (const other of slotCards(slot)) if (other !== uid) holder.discard.push(other)
        return
      }
      if (i !== slot.stack.length - 1) throw new Error('moveCard: only the top card of an evolved Pokémon can move')
      slot.stack.pop()
      clearConditions(slot)
      return
    }
  }
  throw new Error(`moveCard: card ${uid} not found`)
}
