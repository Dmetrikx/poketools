import { describe, expect, it } from 'vitest'
import decksJson from '../catalog/fixtures/decks.json'
import type { FixtureDeck } from '../catalog/types'
import { legalActions } from './actions'
import { Game, replay } from './game'
import { checkAnswer } from './prompt'
import { randomAnswer } from './random'
import { allZoneCards } from './rules'
import { catalogDb, fixtureDeck } from './testing'
import type { Action } from './types'

const decks = decksJson as FixtureDeck[]
const MAX_INPUTS = 400
const OPPONENTS = 2

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WEIGHT: Record<Action['type'], number> = {
  attack: 6, playBasic: 3, evolve: 4, attachEnergy: 4, playTrainer: 2, useAbility: 2, retreat: 0.5,
  endTurn: 1, start: 1, concede: 0, judge: 0,
}

function pick(actions: Action[], rand: () => number): Action {
  const total = actions.reduce((n, a) => n + WEIGHT[a.type], 0)
  let r = rand() * total
  for (const a of actions) if ((r -= WEIGHT[a.type]) <= 0) return a
  return actions[actions.length - 1]
}

describe('fuzz: random legal play', () => {
  for (const [i, deck] of decks.entries()) {
    it(`${deck.archetype} vs ${OPPONENTS} opponents`, () => {
      for (let k = 1; k <= OPPONENTS; k++) {
        const opponent = decks[(i + k) % decks.length]
        const seed = i * 100 + k
        const rand = rng(seed)
        const game = new Game(catalogDb, { seed, decks: [fixtureDeck(deck), fixtureDeck(opponent)] })
        const n = game.state.cards.length
        const label = `${deck.archetype} vs ${opponent.archetype} (seed ${seed})`

        for (let inputs = 0; inputs < MAX_INPUTS && game.state.phase !== 'over'; inputs++) {
          const prompt = game.prompt
          if (prompt) {
            const answer = randomAnswer(prompt, rand)
            expect(checkAnswer(prompt, answer), `${label}: ${prompt.title}`).toBeNull()
            game.dispatch({ answer })
          } else {
            const actions = legalActions({ s: game.state, db: catalogDb })
            expect(actions.length, `${label}: no legal action`).toBeGreaterThan(0)
            game.dispatch({ action: pick(actions, rand) })
          }
          const cards = allZoneCards({ s: game.state, db: catalogDb }).sort((x, y) => x - y)
          expect(cards, `${label}: card conservation`).toEqual([...Array(n).keys()])
        }

        expect(replay(catalogDb, game.record), `${label}: replay`).toEqual(game.state)
      }
    })
  }
})
