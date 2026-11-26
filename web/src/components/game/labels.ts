import { gameDb } from '@/game/db'
import { findSlot, slotName } from '@/game/engine/rules'
import type { Action, GameState } from '@/game/engine/types'

/** A short description of a legal action, for menus. */
export function actionLabel(s: GameState, a: Action): string {
  const ctx = { s, db: gameDb }
  const name = (uid: number) => gameDb.card(s.cards[uid].cardId).name
  const slot = (id: number) => {
    const f = findSlot(ctx, id)
    return f ? slotName(ctx, f.slot) + (f.active ? ' (Active)' : '') : '?'
  }
  switch (a.type) {
    case 'playBasic': return 'Play onto Bench'
    case 'evolve': return `Evolve ${slot(a.target)}`
    case 'attachEnergy': return `Attach to ${slot(a.target)}`
    case 'playTrainer': return a.target !== undefined ? `Attach to ${slot(a.target)}` : 'Play'
    case 'useAbility': return `Use ${a.ability}`
    case 'stadiumAction': return `Use ${s.stadium !== null ? name(s.stadium) : 'Stadium'}`
    case 'retreat': return `Retreat to ${slot(a.to)}${a.discard.length ? ` (discard ${a.discard.map(name).join(', ')})` : ''}`
    case 'attack': return `Attack: ${a.attack}${a.source ? ` (${gameDb.card(a.source).name})` : ''}`
    case 'endTurn': return 'End turn'
    default: return a.type
  }
}

/** Does the action start from this hand card? */
export function fromHandCard(a: Action, uid: number): boolean {
  return ('card' in a && a.card === uid) || (a.type === 'useAbility' && a.source === uid)
}

/** Does the action start from this Pokémon in play? */
export function fromSlot(a: Action, id: number, isActive: boolean): boolean {
  if (a.type === 'useAbility') return a.source === id
  if (a.type === 'attack' || a.type === 'retreat') return isActive
  return false
}
