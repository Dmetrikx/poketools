import { describe, expect, it } from 'vitest'
import decksJson from '@/game/catalog/fixtures/decks.json'
import type { FixtureDeck } from '@/game/catalog/types'
import { E, db, setup, uid } from '@/game/cards/testkit'
import { actionKey, legalActions } from '@/game/engine/actions'
import { Game } from '@/game/engine/game'
import { randomAnswer } from '@/game/engine/random'
import { fixtureDeck } from '@/game/engine/testing'
import type { Action, GameState } from '@/game/engine/types'
import { dropTargets, menuActions, popoverActions, sources, tableActions } from './targets'

const decks = decksJson as FixtureDeck[]
const GOLDEEN = 'PBL-13', DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129'
const AIR_BALLOON = 'ASC-181', AREA_ZERO = 'SCR-131', POFFIN = 'TEF-144'

const legal = (s: GameState) => legalActions({ s, db })
const keys = (m: Map<string, Action[]>) => Object.fromEntries([...m].map(([k, v]) => [k, v.map(a => a.type)]))

describe('dropTargets', () => {
  const s = setup({
    p0: {
      active: { card: DREEPY, energy: [E.P, E.R] },
      bench: [GOLDEEN],
      hand: [GOLDEEN, DRAKLOAK, E.P, AIR_BALLOON, AREA_ZERO, POFFIN],
      deck: [GOLDEEN, GOLDEEN, E.P, E.P],
    },
    p1: { active: GOLDEEN },
  })
  const act = s.players[0].active!.id
  const bench = s.players[0].bench[0].id
  const hand = (id: string) => ({ kind: 'hand', uid: uid(s, 0, 'hand', id) }) as const

  it('sends a Basic to the Bench', () => {
    expect(keys(dropTargets(s, legal(s), hand(GOLDEEN)))).toEqual({ bench: ['playBasic'] })
  })

  it('sends an evolution, Energy and a Tool onto Pokémon', () => {
    expect(keys(dropTargets(s, legal(s), hand(DRAKLOAK)))).toEqual({ [`slot:${act}`]: ['evolve'] })
    expect(keys(dropTargets(s, legal(s), hand(E.P)))).toEqual({ [`slot:${act}`]: ['attachEnergy'], [`slot:${bench}`]: ['attachEnergy'] })
    expect(keys(dropTargets(s, legal(s), hand(AIR_BALLOON)))).toEqual({ [`slot:${act}`]: ['playTrainer'], [`slot:${bench}`]: ['playTrainer'] })
  })

  it('sends a Stadium to the Stadium slot or the mat, and an Item to the mat', () => {
    expect(keys(dropTargets(s, legal(s), hand(AREA_ZERO)))).toEqual({ stadium: ['playTrainer'], play: ['playTrainer'] })
    expect(keys(dropTargets(s, legal(s), hand(POFFIN)))).toEqual({ play: ['playTrainer'] })
  })

  it('puts every way to pay a retreat on the one Bench target', () => {
    const zones = dropTargets(s, legal(s), { kind: 'slot', id: act })
    expect([...zones.keys()]).toEqual([`slot:${bench}`])
    expect(zones.get(`slot:${bench}`)!.map(a => a.type === 'retreat' && a.discard.length)).toEqual([1, 1])
  })

  it('has nothing for a card with no legal action', () => {
    const blocked = setup({ p0: { active: DREEPY, hand: [DRAKLOAK], bench: [] }, p1: { active: GOLDEEN } })
    // Dreepy entered before this turn, so evolving is legal; make it a fresh Dreepy.
    blocked.players[0].active!.enteredTurn = blocked.turn
    const src = { kind: 'hand', uid: blocked.players[0].hand[0] } as const
    expect(dropTargets(blocked, legal(blocked), src).size).toBe(0)
    expect(menuActions(blocked, legal(blocked), src)).toEqual([])
  })

  it('offers attacks from the Active only', () => {
    expect(menuActions(s, legal(s), { kind: 'slot', id: act }).map(a => a.type === 'attack' && a.attack)).toEqual(['Petty Grudge', 'Bite'])
    expect(menuActions(s, legal(s), { kind: 'slot', id: bench })).toEqual([])
  })

  it('lists untargeted plays in the popover', () => {
    expect(popoverActions(s, legal(s), hand(GOLDEEN)).map(a => a.type)).toEqual(['playBasic'])
    expect(popoverActions(s, legal(s), hand(AREA_ZERO)).length).toBe(1)
    expect(popoverActions(s, legal(s), hand(E.P))).toEqual([])
  })
})

/** Every legal action is reachable: by drop, by menu, or by a table button. */
function reachable(s: GameState): void {
  const all = legal(s).filter(a => a.type !== 'start')
  const got = new Set<string>()
  for (const src of sources(s)) {
    for (const list of dropTargets(s, all, src).values()) for (const a of list) got.add(actionKey(a))
    for (const a of menuActions(s, all, src)) got.add(actionKey(a))
  }
  for (const a of tableActions(all)) got.add(actionKey(a))
  for (const a of all) expect(got.has(actionKey(a)), `unreachable: ${actionKey(a)}`).toBe(true)
}

describe('every legal action is reachable from the board', () => {
  for (const i of [0, 5, 10, 15, 20, 25, 30]) {
    const deck = decks[i % decks.length], opp = decks[(i + 7) % decks.length]
    it(`${deck.archetype} vs ${opp.archetype}`, () => {
      let r = i + 11
      const rand = () => (r = (r * 16807) % 2147483647) / 2147483647
      const game = new Game(db, { seed: i, decks: [fixtureDeck(deck), fixtureDeck(opp)] })
      for (let n = 0; n < 250 && game.state.phase !== 'over'; n++) {
        if (game.prompt) { game.dispatch({ answer: randomAnswer(game.prompt, rand) }); continue }
        reachable(game.state)
        const actions = legal(game.state)
        // Prefer doing things over ending the turn, so states get busy.
        const busy = actions.filter(a => a.type !== 'endTurn')
        const pool = busy.length && rand() < 0.8 ? busy : actions
        game.dispatch({ action: pool[Math.floor(rand() * pool.length)] })
      }
    })
  }
})
