import { describe, expect, it } from 'vitest'
import decksJson from '@/game/catalog/fixtures/decks.json'
import type { FixtureDeck } from '@/game/catalog/types'
import { E, db, setup } from '@/game/cards/testkit'
import { Game, runStep } from '@/game/engine/game'
import { randomAnswer } from '@/game/engine/random'
import { fixtureDeck } from '@/game/engine/testing'
import { viewer } from './perspective'

const decks = decksJson as FixtureDeck[]
const GOLDEEN = 'PBL-13' // Basic, 70 HP, Pierce [CC] 30

function seeded(seed: number): () => number {
  let a = seed
  return () => (a = (a * 16807) % 2147483647) / 2147483647
}

describe('viewer', () => {
  it('is the turn player when nothing is asked', () => {
    for (const turnPlayer of [0, 1] as const) {
      expect(viewer(setup({ p0: { active: GOLDEEN }, p1: { active: GOLDEEN }, turnPlayer }))).toBe(turnPlayer)
    }
  })

  it('follows the prompt during setup', () => {
    const game = new Game(db, { seed: 7, decks: [fixtureDeck(decks[0]), fixtureDeck(decks[1])] })
    const rand = seeded(3)
    const seen = new Set<number>()
    while (game.state.phase === 'setup' && game.prompt) {
      expect(viewer(game.state)).toBe(game.prompt.player)
      seen.add(game.prompt.player)
      game.dispatch({ answer: randomAnswer(game.prompt, rand) })
    }
    expect(seen).toEqual(new Set([0, 1]))
  })

  it('is the player promoting after a Knock Out', () => {
    const s = setup({
      p0: { active: { card: GOLDEEN, energy: [E.P, E.P] } },
      p1: { active: { card: GOLDEEN, damage: 50 }, bench: [GOLDEEN, GOLDEEN] },
      turnPlayer: 0,
    })
    const mid = runStep(db, s, { action: { type: 'attack', attack: 'Pierce' }, answers: [] })
    expect(mid.pendingPrompt?.player).toBe(1)
    expect(viewer(mid)).toBe(1)
  })

  it('stays put once the game is over', () => {
    const s = setup({ p0: { active: GOLDEEN }, p1: { active: GOLDEEN }, turnPlayer: 1 })
    s.phase = 'over'
    s.winner = 0
    expect(viewer(s)).toBe(1)
  })
})
