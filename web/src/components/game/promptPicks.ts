import type { GameState, Prompt } from '@/game/engine/types'

/**
 * Where each prompt is answered:
 *   board  — Pokémon glow on the table (choosePokemon, distribute)
 *   hand   — cards lift in the asked player's hand (chooseCards from it, face up)
 *   tray   — a dialog of large cards (other chooseCards, order)
 *   dialog — buttons (chooseOption, yesNo)
 */
export type Placement = 'board' | 'hand' | 'tray' | 'dialog'

export function placement(p: Prompt, s: GameState): Placement {
  switch (p.kind) {
    case 'choosePokemon':
    case 'distribute':
      return 'board'
    case 'chooseCards': {
      const hand = s.players[p.player].hand
      return !p.hidden && p.options.length > 0 && p.options.every(uid => hand.includes(uid)) ? 'hand' : 'tray'
    }
    case 'order':
      return 'tray'
    default:
      return 'dialog'
  }
}

/** Toggles a pick. With one allowed, a new pick replaces the old; past the limit, nothing changes. */
export function toggle(picks: number[], id: number, max: number): number[] {
  if (picks.includes(id)) return picks.filter(x => x !== id)
  if (max === 1) return [id]
  return picks.length < max ? [...picks, id] : picks
}

/** A single required pick answers the prompt on click. */
export function answersOnClick(p: Prompt): boolean {
  return (p.kind === 'choosePokemon' || p.kind === 'chooseCards') && p.min === 1 && p.max === 1
}

/** The line under the title: how many to choose. */
export function countLine(p: Prompt, picked: number): string {
  switch (p.kind) {
    case 'chooseCards':
    case 'choosePokemon': {
      const min = Math.min(p.min, p.options.length)
      const range = min === p.max ? `${p.max}` : `${min}–${p.max}`
      return `Choose ${range} · ${picked} chosen`
    }
    case 'order':
      return `Click the cards first to last · ${picked} of ${p.cards.length}`
    case 'distribute':
      return `${p.total - picked} of ${p.total} left to place`
    default:
      return ''
  }
}

/** Steppers for a distribute prompt: what each option may still take. */
export function canAdd(p: Extract<Prompt, { kind: 'distribute' }>, counts: number[], i: number): boolean {
  const total = counts.reduce((a, b) => a + b, 0)
  return total < p.total && (!p.maxEach || counts[i] < p.maxEach[i])
}
