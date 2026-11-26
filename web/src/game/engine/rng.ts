import type { GameState } from './types'

// mulberry32: small, fast, and its whole state is one uint32 kept in the
// game state, so every coin flip and shuffle replays identically.

export function random(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** true = heads. */
export function coin(s: GameState): boolean {
  return random(s) < 0.5
}

/** Fisher-Yates in place. */
export function shuffleInPlace<T>(s: GameState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]]
  }
}
