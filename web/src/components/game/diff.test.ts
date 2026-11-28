import { describe, expect, it } from 'vitest'
import { E, db, drive, setup } from '@/game/cards/testkit'
import { runStep } from '@/game/engine/game'
import { diff, isEmpty } from './diff'

const GOLDEEN = 'PBL-13' // Basic, 70 HP, Pierce [CC] 30
const DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129'
const KANGASKHAN = 'MEG-104' // Rapid-Fire Combo [CCC]: flip until tails

describe('diff', () => {
  it('is empty for the same state', () => {
    const s = setup({ p0: { active: GOLDEEN }, p1: { active: GOLDEEN } })
    expect(isEmpty(diff(s, s))).toBe(true)
  })

  it('sees a draw at the start of the next turn', () => {
    const s = setup({ p0: { active: GOLDEEN }, p1: { active: GOLDEEN } })
    const next = drive(s, { type: 'endTurn' })
    const c = diff(s, next)
    expect(c.turnStarted).toBe(true)
    expect(c.moves).toEqual([{ uid: s.players[1].deck[0], from: { zone: 'deck', player: 1 }, to: { zone: 'hand', player: 1 } }])
  })

  it('sees a Basic played, Energy attached and an evolution', () => {
    const s = setup({ p0: { active: DREEPY, hand: [GOLDEEN, E.P, DRAKLOAK] }, p1: { active: GOLDEEN } })
    const [basic, energy, evo] = s.players[0].hand
    const active = s.players[0].active!.id

    const a = drive(s, { type: 'playBasic', card: basic })
    expect(diff(s, a).moves).toEqual([{ uid: basic, from: { zone: 'hand', player: 0 }, to: { zone: 'bench', player: 0, slot: basic } }])

    const b = drive(a, { type: 'attachEnergy', card: energy, target: active })
    expect(diff(a, b).moves).toEqual([{ uid: energy, from: { zone: 'hand', player: 0 }, to: { zone: 'attached', player: 0, slot: active } }])

    const c = drive(b, { type: 'evolve', card: evo, target: active })
    expect(diff(b, c).moves).toEqual([{ uid: evo, from: { zone: 'hand', player: 0 }, to: { zone: 'active', player: 0, slot: active } }])
  })

  it('sees an attack, its damage, a Knock Out and the Prize taken', () => {
    const s = setup({
      p0: { active: { card: GOLDEEN, energy: [E.P, E.P] } },
      p1: { active: { card: GOLDEEN, damage: 40 }, bench: [GOLDEEN, GOLDEEN] },
    })
    const attacker = s.players[0].active!.id
    const target = s.players[1].active!.id

    // Damage without a Knock Out.
    const before = setup({ p0: { active: { card: GOLDEEN, energy: [E.P, E.P] } }, p1: { active: GOLDEEN } })
    const hit = drive(before, { type: 'attack', attack: 'Pierce' })
    const plain = diff(before, hit)
    expect(plain.damage).toEqual([{ slot: before.players[1].active!.id, delta: 30 }])
    expect(plain.attacked).toBe(before.players[0].active!.id)

    // Knock Out: stop at the promotion prompt so the turn hasn't moved on.
    const mid = runStep(db, s, { action: { type: 'attack', attack: 'Pierce' }, answers: [] })
    const c = diff(s, mid)
    expect(c.attacked).toBe(attacker)
    expect(c.knockedOut).toEqual([target])
    const toDiscard = c.moves.filter(m => m.to.zone === 'discard').map(m => m.uid)
    expect(toDiscard).toContain(target)
    const prize = c.moves.filter(m => m.from.zone === 'prizes')
    expect(prize).toHaveLength(1)
    expect(prize[0].to).toEqual({ zone: 'hand', player: 0 })
  })

  it('surfaces coin results', () => {
    const s = setup({ p0: { active: { card: KANGASKHAN, energy: [E.P, E.P, E.P] } }, p1: { active: { card: GOLDEEN } } , seed: 5 })
    const next = drive(s, { type: 'attack', attack: 'Rapid-Fire Combo' })
    const c = diff(s, next)
    expect(c.coins.length).toBeGreaterThan(0)
    expect(c.coins[c.coins.length - 1]).toBe(false)
    expect(c.coins.slice(0, -1).every(Boolean)).toBe(true)
  })

  it('reports the winner once', () => {
    const s = setup({ p0: { active: GOLDEEN }, p1: { active: GOLDEEN } })
    const over = drive(s, { type: 'concede', player: 1 })
    expect(diff(s, over).winner).toBe(0)
    expect(diff(over, over).winner).toBeNull()
  })
})
