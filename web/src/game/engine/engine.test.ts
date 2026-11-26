import { describe, expect, it } from 'vitest'
import decksJson from '../catalog/fixtures/decks.json'
import type { FixtureDeck } from '../catalog/types'
import { actionKey, legalActions, retreatPayments } from './actions'
import { Game, replay, runStep } from './game'
import { random } from './rng'
import { allZoneCards, canPay, unitsPay } from './rules'
import { attack, catalogDb, dbFrom, energy, fixtureDeck, pokemon, scenario, trainer } from './testing'
import type { Action, Answer, Ctx, GameState } from './types'

const FIRE = energy('Fire')
const WATER = energy('Water')
const db = dbFrom([
  FIRE, WATER,
  pokemon('Charm', { name: 'Charm', hp: 70, types: ['Fire'], weakness: { type: 'Water', value: '×2' }, attacks: [attack('Scratch', ['Colorless'], 30), attack('Blast', ['Fire', 'Fire'], 60)] }),
  pokemon('Charm2', { name: 'Charm2', subtype: 'Stage 1', evolveFrom: 'Charm', hp: 120, types: ['Fire'], attacks: [attack('Flame', ['Fire'], 90)] }),
  pokemon('Squirt', { name: 'Squirt', hp: 60, types: ['Water'], resistance: { type: 'Fire', value: '-30' }, retreat: 2, attacks: [attack('Splash', ['Water'], 20)] }),
  pokemon('Bigex', { name: 'Big ex', hp: 200, types: ['Water'], tags: ['ex'], attacks: [attack('Wave', [], 10)] }),
  pokemon('Megaex', { name: 'Mega Big ex', hp: 300, types: ['Water'], tags: ['ex', 'Mega'], attacks: [attack('Wave', [], 10)] }),
  pokemon('Wall', { name: 'Wall', hp: 300, types: ['Metal'], retreat: 0, attacks: [attack('Poke', [], 10)] }),
  trainer('Tool', 'Tool'), trainer('StadiumA', 'Stadium'), trainer('Ball', 'Item'),
])

const ctxOf = (s: GameState): Ctx => ({ s, db })
const run = (s: GameState, action: Action, answers: Answer[] = []) => runStep(db, s, { action, answers })
const has = (s: GameState, a: Action) => legalActions(ctxOf(s)).some(x => actionKey(x) === actionKey(a))
const uids = (s: GameState, p: 0 | 1, zone: 'hand' | 'deck' | 'discard' | 'prizes') => s.players[p][zone]

describe('setup', () => {
  it('flips, deals, places Pokémon and prizes, then starts turn 1 with a draw', () => {
    const [a, b] = decksJson as FixtureDeck[]
    const game = new Game(catalogDb, { seed: 7, decks: [fixtureDeck(a), fixtureDeck(b)] })
    let guard = 0
    while (game.prompt && guard++ < 20) {
      const p = game.prompt
      game.dispatch({ answer: p.kind === 'chooseOption' ? [0] : p.kind === 'chooseCards' ? p.options.slice(0, p.min) : [] })
    }
    const s = game.state
    expect(s.phase).toBe('main')
    expect(s.turn).toBe(1)
    for (const pl of s.players) {
      expect(pl.active).not.toBeNull()
      expect(pl.prizes).toHaveLength(6)
    }
    const first = s.players[s.firstPlayer]
    expect(first.hand.length + first.bench.length + 1).toBeGreaterThanOrEqual(8)
    expect(allZoneCards(ctxOf(s)).sort((x, y) => x - y)).toEqual([...Array(120).keys()])
  })

  it('replays to the same state', () => {
    const [a, b] = decksJson as FixtureDeck[]
    const game = new Game(catalogDb, { seed: 3, decks: [fixtureDeck(a), fixtureDeck(b)] })
    while (game.prompt) game.dispatch({ answer: game.prompt.kind === 'chooseCards' ? game.prompt.options.slice(0, 1) : [0] })
    expect(replay(catalogDb, game.record)).toEqual(game.state)
  })
})

describe('turn rules', () => {
  const base = () => scenario({
    filler: FIRE.id, turn: 1, turnPlayer: 0, firstPlayer: 0,
    p0: { active: { card: 'Charm', entered: 0 }, hand: ['Charm2', FIRE.id, FIRE.id, 'Charm', 'Ball'] },
    p1: { active: { card: 'Squirt', entered: 0 } },
  })

  it('the first player can\'t attack or evolve on turn 1', () => {
    const s = base()
    s.players[0].active!.energy.push(...s.players[0].hand.slice(1, 2))
    const acts = legalActions(ctxOf(s))
    expect(acts.some(a => a.type === 'attack')).toBe(false)
    expect(acts.some(a => a.type === 'evolve')).toBe(false)
  })

  it('allows one Energy attachment per turn', () => {
    let s = base()
    const [, e1, e2] = uids(s, 0, 'hand')
    const target = s.players[0].active!.id
    s = run(s, { type: 'attachEnergy', card: e1, target })
    expect(has(s, { type: 'attachEnergy', card: e2, target })).toBe(false)
  })

  it('evolves a Pokémon that has been in play since before this turn', () => {
    let s = base()
    s.turn = 3
    const [evo] = uids(s, 0, 'hand')
    const target = s.players[0].active!.id
    s = run(s, { type: 'evolve', card: evo, target })
    expect(s.players[0].active!.stack).toHaveLength(2)
    s = run(s, { type: 'playBasic', card: uids(s, 0, 'hand').find(u => s.cards[u].cardId === 'Charm')! })
    expect(has(s, { type: 'evolve', card: evo, target: s.players[0].bench[0].id })).toBe(false)
  })

  it('doesn\'t offer Items without an effect yet, but offers Tools and Stadiums', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Charm', hand: ['Ball', 'Tool', 'StadiumA'] }, p1: { active: 'Squirt' } })
    const [ball, tool, stadium] = uids(s, 0, 'hand')
    expect(has(s, { type: 'playTrainer', card: ball })).toBe(false)
    expect(has(s, { type: 'playTrainer', card: tool, target: s.players[0].active!.id })).toBe(true)
    expect(has(s, { type: 'playTrainer', card: stadium })).toBe(true)
  })

  it('ending the turn passes it and the next player draws', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: 'Squirt' } })
    s = run(s, { type: 'endTurn' })
    expect(s.turnPlayer).toBe(1)
    expect(s.turn).toBe(4)
    expect(uids(s, 1, 'hand')).toHaveLength(1)
  })

  it('a player who can\'t draw at the start of their turn loses', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: 'Squirt', deck: [] } })
    s = run(s, { type: 'endTurn' })
    expect(s.phase).toBe('over')
    expect(s.winner).toBe(0)
  })
})

describe('energy', () => {
  it('pays typed costs before colorless, with wildcards last', () => {
    expect(unitsPay(['Fire', 'Water'], ['Fire', 'Colorless'])).toBe(true)
    expect(unitsPay(['Water', 'Water'], ['Fire'])).toBe(false)
    expect(unitsPay(['Any', 'Water'], ['Fire', 'Water'])).toBe(true)
    expect(unitsPay(['Fire'], ['Fire', 'Colorless'])).toBe(false)
  })

  it('checks the Energy attached to a Pokémon', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Charm', energy: [FIRE.id, WATER.id] } }, p1: { active: 'Squirt' } })
    const slot = s.players[0].active!
    expect(canPay(ctxOf(s), slot, ['Fire', 'Colorless'])).toBe(true)
    expect(canPay(ctxOf(s), slot, ['Fire', 'Fire'])).toBe(false)
  })
})

describe('damage', () => {
  const fight = (attacker: string, defender: string, name: string, energyIds: string[]) => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: attacker, energy: energyIds } }, p1: { active: defender, bench: ['Wall'] } })
    return run(s, { type: 'attack', attack: name })
  }

  it('applies Weakness ×2 to the Defending Pokémon', () => {
    const s = fight('Squirt', 'Charm', 'Splash', [WATER.id])
    expect(s.players[1].active!.damage).toBe(40)
  })

  it('applies Resistance −30', () => {
    const s = fight('Charm', 'Squirt', 'Blast', [FIRE.id, FIRE.id])
    expect(s.players[1].active!.damage).toBe(30)
  })

  it('Knocks Out, gives Prizes, and asks for a new Active', () => {
    const s = run(scenario({ filler: FIRE.id, p0: { active: { card: 'Charm2', energy: [FIRE.id] } }, p1: { active: 'Charm', bench: ['Wall', 'Squirt'] } }), { type: 'attack', attack: 'Flame' })
    expect(s.players[0].prizes).toHaveLength(5)
    expect(s.pendingPrompt?.kind).toBe('choosePokemon')
    expect(s.pendingPrompt?.player).toBe(1)
  })

  it('gives 2 Prizes for a Pokémon ex and 3 for a Mega Evolution Pokémon ex', () => {
    for (const [card, prizes] of [['Bigex', 4], ['Megaex', 3]] as const) {
      const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Charm', energy: [FIRE.id] } }, p1: { active: { card, damage: 290 }, bench: ['Wall'] } })
      const after = run(s, { type: 'attack', attack: 'Scratch' }, [])
      expect(after.players[0].prizes, card).toHaveLength(prizes)
    }
  })

  it('wins by taking the last Prize card', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Charm', energy: [FIRE.id] }, prizes: 1 }, p1: { active: { card: 'Charm', damage: 40 }, bench: ['Wall'] } })
    const after = run(s, { type: 'attack', attack: 'Scratch' })
    expect(after.phase).toBe('over')
    expect(after.winner).toBe(0)
  })

  it('promotes the only Benched Pokémon without asking', () => {
    const s = fight('Charm2', 'Charm', 'Flame', [FIRE.id])
    expect(s.pendingPrompt).toBeNull()
    expect(s.players[1].active?.id).toBeDefined()
  })

  it('wins when the opponent has no Pokémon left in play', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Charm', energy: [FIRE.id] } }, p1: { active: { card: 'Charm', damage: 40 } } })
    expect(run(s, { type: 'attack', attack: 'Scratch' }).winner).toBe(0)
  })
})

describe('Special Conditions', () => {
  it('Asleep and Paralyzed Pokémon can\'t attack or retreat', () => {
    for (const rotation of ['asleep', 'paralyzed'] as const) {
      const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Charm', rotation, energy: [FIRE.id] }, bench: ['Wall'] }, p1: { active: 'Squirt' } })
      const acts = legalActions(ctxOf(s))
      expect(acts.some(a => a.type === 'attack' || a.type === 'retreat'), rotation).toBe(false)
    }
  })

  it('Poison puts 1 damage counter on the Pokémon between turns', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: { card: 'Squirt', poisoned: true } } })
    expect(run(s, { type: 'endTurn' }).players[1].active!.damage).toBe(10)
  })

  it('Burn puts 2 damage counters, then a heads flip removes it', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: { card: 'Squirt', burned: true } } })
    const heads = random({ ...s }) < 0.5
    const after = run(s, { type: 'endTurn' })
    expect(after.players[1].active!.damage).toBe(20)
    expect(after.players[1].active!.burned).toBe(!heads)
  })

  it('Paralysis wears off after its owner\'s next turn, not before', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: { card: 'Squirt', rotation: 'paralyzed' } } })
    s = run(s, { type: 'endTurn' })
    expect(s.players[1].active!.rotation).toBe('paralyzed')
    s = run(s, { type: 'endTurn' })
    expect(s.players[1].active!.rotation).toBeNull()
  })

  it('Confusion: tails fails the attack and puts 3 damage counters on the attacker', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = scenario({ seed, filler: FIRE.id, p0: { active: { card: 'Charm', rotation: 'confused', energy: [FIRE.id] } }, p1: { active: 'Wall', bench: ['Squirt'] } })
      const heads = random({ ...s }) < 0.5
      const after = run(s, { type: 'attack', attack: 'Scratch' })
      if (heads) expect(after.players[1].active!.damage).toBe(30)
      else {
        expect(after.players[1].active!.damage).toBe(0)
        expect(after.players[0].active!.damage).toBe(30)
      }
    }
  })
})

describe('retreat', () => {
  it('pays exactly the Retreat Cost and clears Special Conditions', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: { card: 'Squirt', energy: [FIRE.id, WATER.id, WATER.id], poisoned: true }, bench: ['Charm'] }, p1: { active: 'Charm' } })
    const ctx = ctxOf(s)
    const payments = retreatPayments(ctx, s.players[0].active!)
    expect(payments.every(p => p.length === 2)).toBe(true)
    expect(payments).toHaveLength(3)
    s = run(s, { type: 'retreat', to: s.players[0].bench[0].id, discard: payments[0] })
    const benched = s.players[0].bench[0]
    expect(benched.poisoned).toBe(false)
    expect(benched.energy).toHaveLength(1)
    expect(s.players[0].discard).toHaveLength(2)
    expect(legalActions(ctxOf(s)).some(a => a.type === 'retreat')).toBe(false)
  })
})

describe('Game', () => {
  it('undoes answers and actions, and rejects illegal input', () => {
    const [a, b] = decksJson as FixtureDeck[]
    const game = new Game(catalogDb, { seed: 11, decks: [fixtureDeck(a), fixtureDeck(b)] })
    const firstPrompt = game.prompt
    game.dispatch({ answer: [0] })
    expect(game.undo()).toBe(true)
    expect(game.prompt).toEqual(firstPrompt)
    expect(() => game.dispatch({ action: { type: 'endTurn' } })).toThrow()
  })

  it('applies judge overrides as replayable steps', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'Charm' }, p1: { active: 'Squirt', bench: ['Wall', 'Charm'] } })
    s = run(s, { type: 'judge', judge: { op: 'setDamage', slot: s.players[1].active!.id, damage: 60 } })
    expect(s.players[0].prizes).toHaveLength(5)
    expect(s.pendingPrompt?.kind).toBe('choosePokemon')
  })
})
