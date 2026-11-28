// Scenario tests for the cards that entered the pool from the Standard
// events after LAIC (5+ lists): Pokémon and trainers.

import { describe, expect, it } from 'vitest'
import { thisTurn } from '../../engine/rules'
import type { GameState } from '../../engine/types'
import { E, answers, can, canPlay, db, drive, ids, play, setup, uid } from '../testkit'

const GOLDEEN = 'PBL-13'         // Water Basic 70, Pierce CC 30
const KANGASKHAN = 'MEG-104'     // Mega ex 300, weak to Fighting
const LITWICK = 'PBL-36'         // Psychic Basic 70
const DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129'
const BRONZOR = 'TEF-68', BRONZONG = 'TEF-69'
const WOOLOO = 'JTG-135', DUBWOOL = 'JTG-136'
const CHARCADET = 'SSP-32', CERULEDGE = 'SSP-36'
const F = 'MEE-14'

const act = (s: GameState, name: string, pick = answers()) => drive(s, { type: 'attack', attack: name }, pick)
const end = (s: GameState) => drive(s, { type: 'endTurn' })
const koLastTurn = (s: GameState, cardId = GOLDEEN) =>
  s.history.push({ turn: s.turn - 1, player: 1, knockOuts: [{ slot: 999, owner: 0, cardId, byAttack: true }], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
const hand = (s: GameState, p: 0 | 1 = 0) => ids(s, s.players[p].hand)

describe('post-LAIC Pokémon', () => {
  it("Bronzong's Evolution Jammer stops the opponent evolving from hand next turn", () => {
    let s = setup({ p0: { active: { card: BRONZONG, under: [BRONZOR], energy: [E.P] } }, p1: { active: DREEPY, hand: [DRAKLOAK] } })
    s = act(s, 'Evolution Jammer')
    const evolve = { type: 'evolve' as const, card: uid(s, 1, 'hand', DRAKLOAK), target: s.players[1].active!.id }
    expect(can(s, evolve)).toBe(false)
    s = end(end(s))
    expect(can(s, evolve)).toBe(true)
  })

  it('Bronzor does 30 more to a {P} Pokémon', () => {
    const at = (def: string) => act(setup({ p0: { active: { card: BRONZOR, energy: [E.P] } }, p1: { active: def } }), 'Mirror Attack').players[1].active!.damage
    expect([at(LITWICK), at(GOLDEEN)]).toEqual([40, 10])
  })

  it('Smoochum attaches up to 2 Basic {P} Energy from the deck to 1 Benched Pokémon', () => {
    const s = act(setup({ p0: { active: 'SSP-75', bench: [GOLDEEN], deck: [E.W, E.P, E.P, E.P] }, p1: { active: GOLDEEN } }), 'Delightful Kiss')
    expect(ids(s, s.players[0].bench[0].energy)).toEqual([E.P, E.P])
  })

  it("Elgyem moves an Energy between the opponent's Pokémon", () => {
    const s = act(setup({ p0: { active: { card: 'BLK-40', energy: [E.P] } }, p1: { active: { card: GOLDEEN, energy: [E.W] }, bench: [GOLDEEN] } }), 'Slight Shift')
    expect([s.players[1].active!.energy.length, s.players[1].bench[0].energy.length]).toEqual([0, 1])
  })

  it('Ceruledge ex counts the Energy cards in the discard pile', () => {
    const s = act(setup({ p0: { active: { card: CERULEDGE, under: [CHARCADET], energy: [E.R] }, discard: [E.R, E.P, E.M] }, p1: { active: KANGASKHAN } }), 'Abyssal Flames')
    expect(s.players[1].active!.damage).toBe(90)
  })

  it('Spectrier discards its Energy and places 12 damage counters', () => {
    const start = setup({ p0: { active: { card: 'ASC-98', energy: [E.P, E.P, E.P] } }, p1: { active: GOLDEEN, bench: [KANGASKHAN] } })
    const s = act(start, 'Phantasmal Barrage', answers([start.players[1].bench[0].id]))
    expect(s.players[1].bench[0].damage).toBe(120)
    expect(s.players[0].active!.energy).toHaveLength(0)
  })

  it('Stunfisk: the Defending Pokémon takes 100 more from attacks on your next turn and can\'t retreat', () => {
    let s = act(setup({ p0: { active: { card: 'ASC-62', energy: [E.L, E.L] } }, p1: { active: { card: KANGASKHAN, energy: [E.W] }, bench: [GOLDEEN] } }), 'Pouncing Trap')
    expect(s.players[1].active!.damage).toBe(30)
    expect(can(s, { type: 'retreat', to: s.players[1].bench[0].id, discard: [s.players[1].active!.energy[0]] })).toBe(false)
    s = act(end(s), 'Pouncing Trap')
    expect(s.players[1].active!.damage).toBe(30 + 130)
  })

  it('Mega Absol ex Knocks Out an Active with exactly 6 damage counters', () => {
    const run = (damage: number) => act(setup({ p0: { active: { card: 'MEG-86', energy: [E.D, E.D] } }, p1: { active: { card: KANGASKHAN, damage }, bench: [GOLDEEN] } }), 'Terminal Period')
    expect(ids(run(60), run(60).players[1].discard)).toContain(KANGASKHAN)
    expect(run(50).players[1].active!.damage).toBe(50)
  })

  it('Relicanth lets an evolved Pokémon use its previous Evolution\'s attacks', () => {
    const spec = (bench: string[]) => setup({ p0: { active: { card: DRAKLOAK, under: [DREEPY], energy: [E.R, E.P] }, bench }, p1: { active: GOLDEEN } })
    const bite = { type: 'attack' as const, attack: 'Bite', source: DREEPY }
    expect(can(spec([]), bite)).toBe(false)
    expect(can(spec(['TEF-84']), bite)).toBe(true)
  })

  it("Zoroark's Foul Play uses the opponent's Active Pokémon's attack", () => {
    const s = act(setup({ p0: { active: { card: 'WHT-62', energy: [E.D, E.D, E.D] } }, p1: { active: KANGASKHAN, bench: [] } }), 'Foul Play', answers([0]))
    expect(s.players[1].active!.damage).toBe(200)
  })

  it("Hop's Dubwool switches in a Benched Pokémon when it evolves from hand", () => {
    let s = setup({ p0: { active: WOOLOO, hand: [DUBWOOL] }, p1: { active: GOLDEEN, bench: [KANGASKHAN] } })
    const target = s.players[1].bench[0].id
    s = drive(s, { type: 'evolve', card: uid(s, 0, 'hand', DUBWOOL), target: s.players[0].active!.id })
    expect(s.players[1].active!.id).toBe(target)
  })

  it("Hop's Cramorant only hits when the opponent has 3 or 4 Prizes left", () => {
    const at = (prizes: number) => act(setup({ p0: { active: { card: 'JTG-138', energy: [E.W] } }, p1: { active: KANGASKHAN, prizes } }), 'Fickle Spitting').players[1].active!.damage
    expect([at(4), at(6)]).toEqual([120, 0])
  })

  it("Hop's Snorlax adds 30 to Hop's Pokémon's attacks, once however many are in play", () => {
    const at = (bench: string[]) => act(setup({ p0: { active: { card: WOOLOO, energy: [E.W, E.W, E.W] }, bench }, p1: { active: KANGASKHAN } }), 'Smash Kick').players[1].active!.damage
    expect([at([]), at(['JTG-117']), at(['JTG-117', 'JTG-117'])]).toEqual([50, 80, 80])
  })

  it('Jellicent ex in the Active Spot blocks the opponent\'s Items and Tools', () => {
    const side = { hand: ['MEG-131', 'TEF-154', E.W, E.W] }
    const s = (active: boolean) => setup({ turnPlayer: 1, p0: active ? { active: { card: 'WHT-45', under: ['WHT-44'] } } : { active: GOLDEEN, bench: [{ card: 'WHT-45', under: ['WHT-44'] }] }, p1: { active: GOLDEEN, ...side } })
    expect([canPlay(s(true), 'MEG-131'), canPlay(s(true), 'TEF-154')]).toEqual([false, false])
    expect(canPlay(s(false), 'MEG-131')).toBe(true)
  })

  it("Bouffalant's Ready to Ram puts 6 counters on the next attacker", () => {
    let s = act(setup({ p0: { active: { card: 'SSP-151', energy: [E.W, E.W] }, bench: [GOLDEEN] }, p1: { active: { card: KANGASKHAN, energy: [E.W, E.W, E.W] } } }), 'Ready to Ram')
    s = act(s, 'Rapid-Fire Combo')
    expect(s.players[1].active!.damage).toBe(40 + 60)
  })

  it('Curly Wall needs another Bouffalant and protects Basic {C} Pokémon by 60', () => {
    const at = (bench: string[]) => act(setup({ turnPlayer: 1, p0: { active: 'SCR-119', bench }, p1: { active: { card: GOLDEEN, energy: [E.W, E.W] } } }), 'Pierce').players[0].active!.damage
    expect([at([]), at(['SCR-119']), at(['SCR-119', 'SCR-119'])]).toEqual([30, 0, 0])
  })

  it('Maractus puts 6 counters on the attacker that Knocks it Out', () => {
    const s = act(setup({ turnPlayer: 1, p0: { active: { card: 'JTG-8', damage: 90 }, bench: [GOLDEEN] }, p1: { active: { card: GOLDEEN, energy: [E.W, E.W] } } }), 'Pierce')
    expect(s.players[1].active!.damage).toBe(60)
  })

  it("Team Rocket's Kangaskhan ex hits harder after a Team Rocket Supporter", () => {
    const s = setup({ p0: { active: { card: 'ASC-162', energy: [E.D, E.D, E.D] } }, p1: { active: KANGASKHAN } })
    expect(act(s, 'Wicked Impact').players[1].active!.damage).toBe(120)
    thisTurn({ s, db }).supporters.push("Team Rocket's Petrel")
    expect(act(s, 'Wicked Impact').players[1].active!.damage).toBe(220)
  })

  it('Bloodmoon Ursaluna attaches up to 2 Basic {F} Energy from hand when benched', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['PRE-54', F, F, F] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', 'PRE-54') })
    expect(s.players[0].bench[0].energy).toHaveLength(2)
  })

  it('Drilbur discards up to 3 Basic {F} Energy from the deck when benched', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['TEF-85'], deck: [F, F, F, F, E.W] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', 'TEF-85') })
    expect(ids(s, s.players[0].discard)).toEqual([F, F, F])
  })

  it('Chandelure has each player draw a card', () => {
    let s = setup({ p0: { active: { card: 'TWM-38', under: [LITWICK, 'PBL-37'] } }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'useAbility', source: s.players[0].active!.id, ability: 'Alluring Light' })
    expect([s.players[0].hand.length, s.players[1].hand.length]).toEqual([1, 1])
  })

  it('Lampent benches up to 3 Lampent from the deck', () => {
    const s = act(setup({ p0: { active: { card: 'PBL-37', under: [LITWICK], energy: [E.P] }, deck: ['PBL-37', 'PBL-37', E.P] }, p1: { active: GOLDEEN } }), 'Spreading Light')
    expect(ids(s, s.players[0].bench.map(b => b.stack[0]))).toEqual(['PBL-37', 'PBL-37'])
  })
})

describe('post-LAIC trainers', () => {
  it('Transformation Tome needs 2 copies and swaps a Basic in play with one in the discard pile', () => {
    const TOME = 'CRI-83'
    expect(canPlay(setup({ p0: { active: GOLDEEN, hand: [TOME], discard: [DREEPY] }, p1: { active: GOLDEEN } }), TOME)).toBe(false)
    const s = play(setup({ p0: { active: { card: GOLDEEN, damage: 30, energy: [E.W] }, hand: [TOME, TOME], discard: [DREEPY] }, p1: { active: GOLDEEN } }), TOME)
    const a = s.players[0].active!
    expect(ids(s, a.stack)).toEqual([DREEPY])
    expect(a.id).toBe(a.stack[0])
    expect([a.damage, a.energy.length]).toEqual([30, 1])
    expect(ids(s, s.players[0].discard).sort()).toEqual([GOLDEEN, TOME, TOME].sort())
  })

  it('Maximum Belt adds 50 against an Active Pokémon ex only', () => {
    const at = (def: string) => act(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W], tools: ['TEF-154'] } }, p1: { active: def } }), 'Pierce').players[1].active!.damage
    expect([at(KANGASKHAN), at('MEG-72')]).toEqual([80, 30])
  })

  it("Hop's Choice Band: Hop's attacks cost {C} less and do 30 more", () => {
    const s = setup({ p0: { active: { card: WOOLOO, energy: [E.W, E.W], tools: ['JTG-148'] } }, p1: { active: KANGASKHAN } })
    expect(act(s, 'Smash Kick').players[1].active!.damage).toBe(80)
  })

  it("Postwick adds 30 to Hop's Pokémon's attacks on both sides", () => {
    const s = setup({ stadium: 'JTG-154', p0: { active: { card: WOOLOO, energy: [E.W, E.W, E.W] } }, p1: { active: KANGASKHAN } })
    expect(act(s, 'Smash Kick').players[1].active!.damage).toBe(80)
  })

  it('Sparkling Crystal takes 1 Energy off a Tera Pokémon\'s attacks', () => {
    const base = { card: CERULEDGE, under: [CHARCADET], energy: [E.R, E.P] }
    expect(can(setup({ p0: { active: base }, p1: { active: GOLDEEN } }), { type: 'attack', attack: 'Raging Amethyst' })).toBe(false)
    expect(can(setup({ p0: { active: { ...base, tools: ['SCR-142'] } }, p1: { active: GOLDEEN } }), { type: 'attack', attack: 'Raging Amethyst' })).toBe(true)
  })

  it('Hassel needs a Knock Out last turn and takes up to 3 of the top 8', () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['TWM-151'] }, p1: { active: GOLDEEN } })
    expect(canPlay(s, 'TWM-151')).toBe(false)
    koLastTurn(s)
    expect(play(s, 'TWM-151').players[0].hand).toHaveLength(3)
  })

  it("Larry's Skill discards the hand and finds a Pokémon, a Supporter and a Basic Energy", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['PRE-115', E.W], deck: [GOLDEEN, 'TWM-151', E.P, 'MEG-131'] }, p1: { active: GOLDEEN } }), 'PRE-115')
    expect(hand(s).sort()).toEqual([GOLDEEN, 'TWM-151', E.P].sort())
  })

  it("Morty's Conviction discards a card and draws one per opponent's Benched Pokémon", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-155', E.W] }, p1: { active: GOLDEEN, bench: [GOLDEEN, GOLDEEN, GOLDEEN] } }), 'TEF-155')
    expect(s.players[0].hand).toHaveLength(3)
  })

  it('Rust Syndicate Grunt discards an opponent\'s Energy after a Knock Out', () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['PBL-81'] }, p1: { active: { card: GOLDEEN, energy: [E.W] } } })
    expect(canPlay(s, 'PBL-81')).toBe(false)
    koLastTurn(s)
    expect(play(s, 'PBL-81').players[1].active!.energy).toHaveLength(0)
  })

  it('Tarragon recovers {F} Pokémon and Basic {F} Energy', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['POR-85'], discard: [F, 'TEF-85', GOLDEEN, E.W] }, p1: { active: GOLDEEN } }), 'POR-85')
    expect(hand(s).sort()).toEqual([F, 'TEF-85'].sort())
  })

  it('Tera Orb finds a Tera Pokémon', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['SSP-189'], deck: [GOLDEEN, CERULEDGE] }, p1: { active: GOLDEEN } }), 'SSP-189')
    expect(hand(s)).toEqual([CERULEDGE])
  })

  it('Super Potion heals 60 and discards an Energy', () => {
    const s = play(setup({ p0: { active: { card: GOLDEEN, damage: 50, energy: [E.W, E.W] }, hand: ['JTG-158'] }, p1: { active: GOLDEEN } }), 'JTG-158')
    expect([s.players[0].active!.damage, s.players[0].active!.energy.length]).toEqual([0, 1])
  })

  it('Dark Bell Confuses both non-{D} Active Pokémon', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['PBL-75'] }, p1: { active: 'MEG-86' } }), 'PBL-75')
    expect([s.players[0].active!.rotation, s.players[1].active!.rotation]).toEqual(['confused', null])
  })

  it("Hop's Bag benches up to 2 Basic Hop's Pokémon", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['JTG-147'], deck: [GOLDEEN, WOOLOO, 'JTG-117'] }, p1: { active: GOLDEEN } }), 'JTG-147')
    expect(ids(s, s.players[0].bench.map(b => b.id)).sort()).toEqual([WOOLOO, 'JTG-117'].sort())
  })
})
