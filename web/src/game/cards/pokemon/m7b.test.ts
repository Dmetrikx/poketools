import { describe, expect, it } from 'vitest'
import { legalActions } from '../../engine/actions'
import { abilityOff } from '../../engine/modifiers'
import { attackCost, maxHp, retreatCost } from '../../engine/rules'
import type { GameState } from '../../engine/types'
import { E, answers, can, db, drive, ids, setup, uid } from '../testkit'

const GOLDEEN = 'PBL-13', KANGASKHAN = 'MEG-104', DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129', DRAGAPULT = 'TWM-130'
const ctx = (s: GameState) => ({ s, db })
const act = (s: GameState, name: string, pick = answers()) => drive(s, { type: 'attack', attack: name }, pick)
const ability = (s: GameState, source: number, name: string, pick = answers()) => drive(s, { type: 'useAbility', source, ability: name }, pick)
const tank = { card: DRAGAPULT, under: [DREEPY, DRAKLOAK] }

describe('Team Rocket', () => {
  it("Team Rocket's Mewtwo ex can't attack with fewer than 4 Team Rocket's Pokémon", () => {
    const base = { card: 'DRI-81', energy: [E.P, E.P, E.P] }
    expect(can(setup({ p0: { active: base, bench: ['DRI-127', 'DRI-127'] }, p1: { active: GOLDEEN } }), { type: 'attack', attack: 'Erasure Ball' })).toBe(false)
    expect(can(setup({ p0: { active: base, bench: ['DRI-127', 'DRI-127', 'DRI-127'] }, p1: { active: GOLDEEN } }), { type: 'attack', attack: 'Erasure Ball' })).toBe(true)
  })

  it('Torment stops the Defending Pokémon using the chosen attack next turn', () => {
    let s = act(setup({ p0: { active: { card: 'DRI-127', energy: [E.D, E.D] } }, p1: { active: { card: GOLDEEN, energy: [E.W, E.W] } } }), 'Torment')
    expect(s.turnPlayer).toBe(1)
    expect(can(s, { type: 'attack', attack: 'Pierce' })).toBe(false)
    s = drive(drive(s, { type: 'endTurn' }), { type: 'endTurn' })
    expect(can(s, { type: 'attack', attack: 'Pierce' })).toBe(true)
  })

  it("Team Rocket's Mimikyu copies the opponent's Active Tera Pokémon's attack", () => {
    const s = act(setup({ p0: { active: { card: 'DRI-87', energy: [E.P, E.P] } }, p1: { active: { card: 'TWM-25', energy: [E.G, E.G] } } }), 'Gemstone Mimicry')
    expect(s.players[1].active!.damage).toBe(150)
  })

  it("Team Rocket's Wobbuffet moves all damage counters from a Benched Team Rocket's Pokémon", () => {
    const s = setup({ p0: { active: { card: 'DRI-82', energy: [E.P, E.P] }, bench: [{ card: 'DRI-127', damage: 50 }] }, p1: { active: KANGASKHAN } })
    const after = act(s, 'Rocket Mirror')
    expect([after.players[0].bench[0].damage, after.players[1].active!.damage]).toEqual([0, 50])
  })
})

describe("Hide 'n' Sneak and Festival Lead", () => {
  it("Hide 'n' Sneak blocks counters from attacks but not damage", () => {
    const s = setup({ p0: { active: { card: DRAGAPULT, under: [DREEPY, DRAKLOAK], energy: [E.R, E.P] } }, p1: { active: KANGASKHAN, bench: ['PBL-33', KANGASKHAN] } })
    const after = act(s, 'Phantom Dive', answers([3, 3]))
    expect(after.players[1].bench.map(b => b.damage)).toEqual([0, 30])
    expect(after.players[1].active!.damage).toBe(200)
  })

  it('Dhelmise needs 4 Hide \'n\' Sneak Pokémon in the discard pile', () => {
    const four = act(setup({ p0: { active: { card: 'PBL-39', energy: [E.P] }, discard: ['PBL-33', 'PBL-33', 'PBL-34', 'PBL-5'] }, p1: { active: tank } }), 'Vengeful Anchor')
    expect(four.players[1].active!.damage).toBe(170)
  })

  it('Bloodmoon Ursaluna ex costs {C} less per Prize the opponent has taken', () => {
    const s = setup({ p0: { active: 'TWM-141' }, p1: { active: GOLDEEN, prizes: 3 } })
    const bloodMoon = db.card('TWM-141').attacks!.find(a => a.name === 'Blood Moon')!
    expect(attackCost(ctx(s), s.players[0].active!, bloodMoon)).toHaveLength(2)
  })

  it('Thwackey searches when the Active Pokémon has Festival Lead', () => {
    const s = setup({ p0: { active: 'TWM-44', bench: [{ card: 'TWM-15', under: ['TWM-14'] }], deck: ['MEG-114', E.P] }, p1: { active: GOLDEEN } })
    expect(ability(s, s.players[0].bench[0].id, 'Boom Boom Groove').players[0].hand).toHaveLength(1)
  })
})

describe('Megas', () => {
  it('Mega Charizard X ex does 90 for each {R} Energy discarded from your Pokémon', () => {
    const s = act(setup({ p0: { active: { card: 'PFL-13', under: ['PFL-11', 'PFL-12'], energy: [E.R, E.R] }, bench: [{ card: GOLDEEN, energy: [E.R] }] }, p1: { active: tank } }), 'Inferno X')
    expect(s.players[1].active!.damage).toBe(270)
  })

  it('Mega Greninja ex places 6 damage counters with Mortal Shuriken from the Active Spot', () => {
    const s = setup({ p0: { active: { card: 'CRI-22', under: ['CRI-20', 'CRI-21'] }, hand: [E.W] }, p1: { active: GOLDEEN, bench: [KANGASKHAN] } })
    const after = ability(s, s.players[0].active!.id, 'Mortal Shuriken', answers([s.players[1].bench[0].id]))
    expect(after.players[1].bench[0].damage).toBe(60)
  })

  it('Mega Lopunny ex hits 170 harder after moving up from the Bench this turn', () => {
    let s = setup({ p0: { active: GOLDEEN, bench: [{ card: 'PFL-84', under: ['PFL-83'], energy: [E.P] }], hand: ['MEG-130'] }, p1: { active: tank } })
    s = drive(s, { type: 'playTrainer', card: uid(s, 0, 'hand', 'MEG-130') })
    expect(act(s, 'Gale Thrust').players[1].active!.damage).toBe(230)
  })

  it('Fan Rotom only calls on your first turn', () => {
    const s = setup({ turn: 2, firstPlayer: 1, turnPlayer: 0, p0: { active: 'SCR-118', deck: ['SCR-118', 'SCR-114', GOLDEEN] }, p1: { active: GOLDEEN } })
    expect(ability(s, s.players[0].active!.id, 'Fan Call').players[0].hand).toHaveLength(2)
    expect(can(setup({ p0: { active: 'SCR-118' }, p1: { active: GOLDEEN } }), { type: 'useAbility', source: 0, ability: 'Fan Call' })).toBe(false)
  })

  it('Hariyama brings up a Benched Pokémon when evolved from the hand', () => {
    const s = setup({ p0: { active: 'MEG-72', hand: ['MEG-73'] }, p1: { active: GOLDEEN, bench: [KANGASKHAN] } })
    const after = drive(s, { type: 'evolve', card: s.players[0].hand[0], target: s.players[0].active!.id })
    expect(ids(after, [after.players[1].active!.id])).toEqual([KANGASKHAN])
  })

  it('Lunatone needs Solrock and a Basic {F} Energy to draw 3', () => {
    const s = setup({ p0: { active: 'MEG-74', bench: ['MEG-75'], hand: [E.F] }, p1: { active: GOLDEEN } })
    expect(ability(s, s.players[0].active!.id, 'Lunar Cycle').players[0].hand).toHaveLength(3)
  })

  it('Mega Venusaur ex moves Basic {G} Energy as often as you like', () => {
    let s = setup({ p0: { active: { card: 'MEG-3', under: ['MEG-1', 'MEG-2'], energy: [E.G, E.G] }, bench: [GOLDEEN] }, p1: { active: GOLDEEN } })
    s = ability(s, s.players[0].active!.id, 'Solar Transfer')
    s = ability(s, s.players[0].active!.id, 'Solar Transfer')
    expect(s.players[0].bench[0].energy).toHaveLength(2)
  })

  it('Unown takes 1 more Prize for a Knock Out', () => {
    const s = act(setup({ p0: { active: { card: '30C-72', energy: [E.P, E.P] } }, p1: { active: { card: GOLDEEN, damage: 40 }, bench: [GOLDEEN] } }), 'Mysterious Signal')
    expect(s.players[0].prizes).toHaveLength(4)
  })

  it('Iron Crown ex adds 20 to other Future Pokémon only', () => {
    const s = act(setup({ p0: { active: { card: 'TEF-25', energy: [E.G, E.G, E.G] }, bench: ['TEF-81'] }, p1: { active: tank } }), 'Prism Edge')
    expect(s.players[1].active!.damage).toBe(200)
  })
})

describe('Others', () => {
  it('Durable Body survives a Knock Out on heads only', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed < 20; seed++) {
      const s = act(setup({ seed, p0: { active: { card: KANGASKHAN, energy: [E.P, E.P, E.P] } }, p1: { active: 'PBL-41', bench: [GOLDEEN] } }), 'Rapid-Fire Combo')
      const ape = s.players[1].active && s.cards[s.players[1].active.id].cardId === 'PBL-41' ? s.players[1].active : null
      if (ape) {
        expect(ape.damage).toBe(140)
        outcomes.add('survived')
      } else {
        expect(s.players[0].prizes).toHaveLength(5)
        outcomes.add('knocked out')
      }
    }
    expect(outcomes.size).toBe(2)
  })

  it('Destined Fight Knocks Out both Active Pokémon', () => {
    const s = act(setup({ p0: { active: { card: 'SSP-100', under: ['PBL-46', 'PBL-46'], energy: [E.F, E.F] }, bench: [GOLDEEN] }, p1: { active: KANGASKHAN, bench: [GOLDEEN] } }), 'Destined Fight')
    expect([s.players[0].prizes.length, s.players[1].prizes.length]).toEqual([3, 5])
  })

  it('Cursed Blast places counters and Knocks Out the user; Psyduck switches it off', () => {
    const s = setup({ p0: { active: GOLDEEN, bench: [{ card: 'PRE-36', under: ['PRE-35'] }] }, p1: { active: KANGASKHAN, bench: [GOLDEEN] } })
    const after = ability(s, s.players[0].bench[0].id, 'Cursed Blast', answers([s.players[1].active!.id]))
    expect([after.players[1].active!.damage, after.players[0].bench.length, after.players[1].prizes.length]).toEqual([50, 0, 5])
    const damp = setup({ p0: { active: GOLDEEN, bench: [{ card: 'PRE-36', under: ['PRE-35'] }] }, p1: { active: 'ASC-39' } })
    expect(abilityOff(ctx(damp), damp.players[0].bench[0], 'Cursed Blast')).toBe(true)
  })

  it('Flutter Mane switches off the opponent\'s Active abilities', () => {
    const s = setup({ p0: { active: 'TEF-78' }, p1: { active: KANGASKHAN } })
    expect(abilityOff(ctx(s), s.players[1].active!, 'Run Errand')).toBe(true)
  })

  it('Froslass puts a counter on each Pokémon with an Ability during Checkup', () => {
    const s = drive(setup({ p0: { active: GOLDEEN, bench: [{ card: 'TWM-53', under: ['ASC-46'] }] }, p1: { active: KANGASKHAN } }), { type: 'endTurn' })
    expect([s.players[1].active!.damage, s.players[0].bench[0].damage]).toEqual([10, 0])
  })

  it('Giratina can\'t use Chaos Crawler two turns in a row', () => {
    const s = setup({ p0: { active: { card: 'DLR-45', energy: [E.P, E.P, E.P] } }, p1: { active: tank } })
    s.history.push({ turn: 1, player: 0, knockOuts: [], attacks: [{ slot: s.players[0].active!.id, name: 'Chaos Crawler' }], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
    expect(can(s, { type: 'attack', attack: 'Chaos Crawler' })).toBe(false)
  })

  it('Patrat stops damage counters moving', () => {
    const s = setup({ p0: { active: { card: 'TWM-95', energy: [E.D] }, bench: [{ card: GOLDEEN, damage: 30 }, 'CRI-70'] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Adrena-Brain', answers([s.players[0].bench[0].id], [s.players[1].active!.id], [2]))
    expect(after.players[0].bench[0].damage).toBe(30)
  })

  it('Okidogi gets +100 HP and +100 damage with {D} Energy', () => {
    const s = setup({ p0: { active: { card: 'TWM-111', energy: [E.D] } }, p1: { active: GOLDEEN } })
    expect(maxHp(ctx(s), s.players[0].active!)).toBe(230)
  })

  it('Eevee ex evolves into a Pokémon ex that evolves from Eevee', () => {
    const s = setup({ p0: { active: 'PRE-75', hand: ['PRE-30'] }, p1: { active: GOLDEEN } })
    expect(can(s, { type: 'evolve', card: s.players[0].hand[0], target: s.players[0].active!.id })).toBe(true)
  })

  it('Charmander has no Retreat Cost without Energy', () => {
    const s = setup({ p0: { active: 'PFL-11', bench: [{ card: 'PFL-11', energy: [E.R] }] }, p1: { active: GOLDEEN } })
    expect([retreatCost(ctx(s), s.players[0].active!), retreatCost(ctx(s), s.players[0].bench[0])]).toEqual([0, db.card('PFL-11').retreat])
  })

  it('Pecharunt adds 5 Poison counters while Active', () => {
    const s = drive(setup({ p0: { active: 'SVP-149' }, p1: { active: { card: KANGASKHAN, poisoned: true } } }), { type: 'endTurn' })
    expect(s.players[1].active!.damage).toBe(60)
  })

  it('Arboliva ex splits 6 × 20 damage, ignoring Weakness', () => {
    const s = act(setup({ p0: { active: { card: 'DRI-23', under: ['DRI-21', 'DRI-22'], energy: [E.G] } }, p1: { active: tank, bench: [KANGASKHAN] } }), 'Oil Salvo', answers([4, 2]))
    expect([s.players[1].active!.damage, s.players[1].bench[0].damage]).toEqual([80, 40])
  })

  it('Lugia discards a {R}, a {W} and a {L} Energy', () => {
    const s = act(setup({ p0: { active: { card: '30C-121', energy: [E.R, E.W, E.L, E.P] } }, p1: { active: tank } }), 'Elemental Blast')
    expect(ids(s, s.players[0].active!.energy)).toEqual([E.P])
  })

  it('Terapagos ex can\'t use Unified Beatdown on the first turn of the player going second', () => {
    const s = setup({ turn: 2, firstPlayer: 1, turnPlayer: 0, p0: { active: { card: 'SCR-128', energy: [E.P, E.P] }, bench: [GOLDEEN] }, p1: { active: GOLDEEN } })
    expect(can(s, { type: 'attack', attack: 'Unified Beatdown' })).toBe(false)
    expect(legalActions(ctx(s)).some(a => a.type === 'attack')).toBe(false)
  })
})
