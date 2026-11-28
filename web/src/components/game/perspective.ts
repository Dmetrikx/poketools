import type { GameState, PlayerId } from '@/game/engine/types'

/**
 * The player sitting at the bottom of the screen: whoever has to act. A
 * prompt can ask either player (setup, promoting after a Knock Out, effects
 * that make the opponent choose), so it wins over the turn player. Once the
 * game is over, the turn player no longer changes, so the view stays put.
 */
export function viewer(s: GameState): PlayerId {
  return s.pendingPrompt?.player ?? s.turnPlayer
}
