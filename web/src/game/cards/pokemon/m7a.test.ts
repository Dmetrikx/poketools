import { describe, expect, it } from 'vitest'
import { legalActions } from '../../engine/actions'
import { abilityOff } from '../../engine/modifiers'
import { attackCost, energyAlternatives, retreatCost, weaknessOf } from '../../engine/rules'
import { E, answers, can, db, drive, ids, setup, uid } from '../testkit'
import type { GameState } from '../../engine/types'

const GOLDEEN = 'PBL-13', MAKUHITA = 'MEG-72', DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129', DRAGAPULT = 'TWM-130'
const ctx = (s: GameState) => ({ s, db })
const act = (s: GameState, name: string, pick = answers()) => drive(s, { type: 'attack', attack: name }, pick)
const ability = (s: GameState, source: number, name: string, pick = answers()) => drive(s, { type: 'useAbility', source, ability: name }, pick)

describe('Dragapult engines', () => {
  it('Phantom Dive puts 6 damage counters on the Bench any way you like', () => {
    const s = act(setup({ p0: { active: { card: DRAGAPULT, under: [DREEPY, DRAKLOAK], energy: [E.R, E.P] } }, p1: { active: 'MEG-104', bench: [GOLDEEN, GOLDEEN] } }), 'Phantom Dive', answers([4, 2]))
    expect(s.players[1].bench.map(b => b.damage)).toEqual([40, 20])
    expect(s.players[1].active!.damage).toBe(200)
  })

  it('Fezandipiti ex draws 3 only after a Knock Out, once between all Flip the Scripts', () => {
    const s = setup({ p0: { active: 'ASC-142', bench: ['ASC-142'] }, p1: { active: GOLDEEN } })
    expect(legalActions(ctx(s)).some(a => a.type === 'useAbility')).toBe(false)
    s.history.push({ turn: 2, player: 1, knockOuts: [{ slot: 1, owner: 0, cardId: GOLDEEN, byAttack: true }], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
    const after = ability(s, s.players[0].active!.id, 'Flip the Script')
    expect(after.players[0].hand).toHaveLength(3)
    expect(can(after, { type: 'useAbility', source: after.players[0].bench[0].id, ability: 'Flip the Script' })).toBe(false)
  })

  it('Budew stops the opponent playing Items next turn', () => {
    let s = act(setup({ p0: { active: 'ASC-16' }, p1: { active: GOLDEEN, hand: ['MEG-130'], bench: [GOLDEEN] } }), 'Itchy Pollen')
    expect(legalActions(ctx(s)).some(a => a.type === 'playTrainer')).toBe(false)
    s = drive(drive(s, { type: 'endTurn' }), { type: 'endTurn' })
    expect(s.turnPlayer).toBe(1)
  })

  it('Meowth ex searches for a Supporter when played to the Bench, once per turn between Last-Ditch abilities', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['POR-62', 'POR-62'], deck: ['MEG-114', 'MEG-119', E.P] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: s.players[0].hand[0] })
    expect(ids(s, s.players[0].hand)).toContain('MEG-114')
    const before = s.players[0].hand.length
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', 'POR-62') })
    expect(s.players[0].hand.length).toBe(before - 1)
  })

  it('Dudunsparce draws 3 and shuffles itself into the deck', () => {
    const s = setup({ p0: { active: GOLDEEN, bench: [{ card: 'TEF-129', under: ['TEF-128'] }] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].bench[0].id, 'Run Away Draw')
    expect(after.players[0].hand).toHaveLength(3)
    expect(after.players[0].bench).toHaveLength(0)
    expect(after.players[0].deck).toHaveLength(19)
  })

  it('Drakloak puts 1 of the top 2 into the hand and the other on the bottom', () => {
    const s = setup({ p0: { active: { card: DRAKLOAK, under: [DREEPY] }, deck: ['MEG-114', 'MEG-119', E.P] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Recon Directive')
    expect(ids(after, after.players[0].hand)).toEqual(['MEG-114'])
    expect(ids(after, after.players[0].deck)).toEqual([E.P, 'MEG-119'])
  })

  it('Munkidori moves up to 3 damage counters to the opponent with {D} Energy attached', () => {
    const s = setup({ p0: { active: { card: 'TWM-95', energy: [E.D] }, bench: [{ card: GOLDEEN, damage: 50 }] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Adrena-Brain', answers([s.players[0].bench[0].id], [s.players[1].active!.id], [2]))
    expect([after.players[0].bench[0].damage, after.players[1].active!.damage]).toEqual([20, 30])
  })

  it('Dudunsparce ex does 60 for each opposing Pokémon ex', () => {
    const s = act(setup({ p0: { active: { card: 'JTG-121', under: ['JTG-120'], energy: [E.P] } }, p1: { active: 'POR-62', bench: ['ASC-142', GOLDEEN] } }), 'Tenacious Tail')
    expect(s.players[1].active!.damage).toBe(120)
  })
})

describe('Basic Box', () => {
  it('Koraidon ex hits 120 harder after a Knock Out by an attack', () => {
    const s = setup({ p0: { active: { card: 'ASC-121', energy: [E.F, E.F] } }, p1: { active: { card: DRAGAPULT, under: [DREEPY, DRAKLOAK] } } })
    s.history.push({ turn: 2, player: 1, knockOuts: [{ slot: 1, owner: 0, cardId: GOLDEEN, byAttack: true }], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
    expect(act(s, 'Orichalcum Fang').players[1].active!.damage).toBe(170)
  })

  it('Talonflame ex benches itself from the hand with a {C} Mega ex in play', () => {
    const s = setup({ p0: { active: 'MEG-104', hand: ['DLR-88'] }, p1: { active: GOLDEEN } })
    const card = s.players[0].hand[0]
    expect(ability(s, card, 'Excited Dive').players[0].bench.map(b => b.id)).toEqual([card])
  })

  it("Lillie's Clefairy ex turns the opponent's {N} Weakness to {P}", () => {
    const s = setup({ p0: { active: 'JTG-56' }, p1: { active: DREEPY } })
    expect(weaknessOf(ctx(s), s.players[1].active!)?.type).toBe('Psychic')
  })

  it('Mega Kangaskhan ex can Run Errand only from the Active Spot', () => {
    const s = setup({ p0: { active: GOLDEEN, bench: ['MEG-104'] }, p1: { active: GOLDEEN } })
    expect(can(s, { type: 'useAbility', source: s.players[0].bench[0].id, ability: 'Run Errand' })).toBe(false)
  })

  it('Latias ex removes the Retreat Cost of your Basic Pokémon', () => {
    const s = setup({ p0: { active: MAKUHITA, bench: ['SSP-76'] }, p1: { active: MAKUHITA } })
    expect([retreatCost(ctx(s), s.players[0].active!), retreatCost(ctx(s), s.players[1].active!)]).toEqual([0, 2])
  })

  it('Raging Bolt ex does 70 for each Basic Energy discarded from your Pokémon', () => {
    const s = act(setup({ p0: { active: { card: 'TEF-123', energy: [E.L, E.F] }, bench: [{ card: GOLDEEN, energy: [E.W] }] }, p1: { active: 'MEG-104' } }), 'Bellowing Thunder')
    expect(s.players[1].active!.damage).toBe(210)
  })

  it('Teal Mask Ogerpon ex attaches a {G} from hand and draws', () => {
    const s = setup({ p0: { active: 'TWM-25', hand: [E.G] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Teal Dance')
    expect([after.players[0].active!.energy.length, after.players[0].hand.length]).toEqual([1, 1])
  })

  it('Wellspring Mask Ogerpon ex can trade 3 Energy for 120 on the Bench', () => {
    const s = act(setup({ p0: { active: { card: 'TWM-64', energy: [E.W, E.W, E.W] } }, p1: { active: 'MEG-104', bench: ['MEG-104'] } }), 'Torrential Pump')
    expect([s.players[1].active!.damage, s.players[1].bench[0].damage, s.players[0].active!.energy.length]).toEqual([100, 120, 0])
  })
})

describe("N's Zoroark and Slowking", () => {
  it("N's Zoroark ex copies a Benched N's Pokémon's attack", () => {
    const s = act(setup({ p0: { active: { card: 'JTG-98', under: ['JTG-97'], energy: [E.D, E.D] }, bench: ['JTG-26'] }, p1: { active: 'MEG-104' } }), 'Night Joker', answers([1]))
    expect(s.players[1].active!.damage).toBe(50)
  })

  it("N's Zoroark ex: Trade discards a card to draw 2", () => {
    const s = setup({ p0: { active: { card: 'JTG-98', under: ['JTG-97'] }, hand: [E.P] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Trade')
    expect([after.players[0].hand.length, after.players[0].discard.length]).toEqual([2, 1])
  })

  it('Pecharunt ex switches in a Benched {D} Pokémon and Poisons it', () => {
    const s = setup({ p0: { active: GOLDEEN, bench: ['SFA-39', 'JTG-97'] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].bench[0].id, 'Subjugating Chains')
    expect(ids(after, [after.players[0].active!.id])).toEqual(['JTG-97'])
    expect(after.players[0].active!.poisoned).toBe(true)
  })

  it("Mew ex can use a Benched Pokémon's attack with its own Energy", () => {
    const s = setup({ p0: { active: { card: '30C-66', energy: [E.W, E.W] }, bench: [GOLDEEN] }, p1: { active: 'MEG-104' } })
    expect(can(s, { type: 'attack', attack: 'Pierce', source: GOLDEEN })).toBe(true)
    expect(drive(s, { type: 'attack', attack: 'Pierce', source: GOLDEEN }).players[1].active!.damage).toBe(30)
  })

  it('Slowking copies an attack from a Pokémon discarded from the top of the deck', () => {
    const s = act(setup({ p0: { active: { card: 'SCR-58', under: ['SCR-57'], energy: [E.P, E.P] }, deck: [GOLDEEN, E.P] }, p1: { active: 'MEG-104' } }), 'Seek Inspiration')
    expect(s.players[1].active!.damage).toBe(30)
    expect(ids(s, s.players[0].discard)).toEqual([GOLDEEN])
  })

  it("Kyurem's Trifrost costs {C} with a Colress card in the opponent's discard pile", () => {
    const s = setup({ p0: { active: 'SFA-47' }, p1: { active: GOLDEEN, discard: ['SFA-57'] } })
    const trifrost = db.card('SFA-47').attacks!.find(a => a.name === 'Trifrost')!
    expect(attackCost(ctx(s), s.players[0].active!, trifrost)).toEqual(['Colorless'])
  })

  it('Zeraora hits a Benched Pokémon ex for 210 and discards its Energy', () => {
    const s = act(setup({ p0: { active: { card: 'DRI-78', energy: [E.L, E.L, E.L] } }, p1: { active: GOLDEEN, bench: ['MEG-104'] } }), 'Thunder Raid')
    expect([s.players[1].bench[0].damage, s.players[0].active!.energy.length]).toEqual([210, 0])
  })
})

describe('Crustle and Hydrapple', () => {
  it('Crustle takes no damage from Pokémon ex', () => {
    const s = act(setup({ p0: { active: { card: 'MEG-104', energy: [E.P, E.P, E.P] } }, p1: { active: { card: 'DRI-12', under: ['DRI-11'] } } }), 'Rapid-Fire Combo')
    expect(s.players[1].active!.damage).toBe(0)
  })

  it('Cornerstone Mask Ogerpon ex takes no damage from Pokémon with an Ability', () => {
    const s = act(setup({ p0: { active: { card: 'MEG-104', energy: [E.P, E.P, E.P] } }, p1: { active: 'TWM-112' } }), 'Rapid-Fire Combo')
    expect(s.players[1].active!.damage).toBe(0)
  })

  it('Dwebble evolves itself from the deck', () => {
    const s = act(setup({ p0: { active: { card: 'DRI-11', energy: [E.G] }, deck: ['DRI-12', E.P] }, p1: { active: GOLDEEN } }), 'Ascension')
    expect(ids(s, s.players[0].active!.stack)).toEqual(['DRI-11', 'DRI-12'])
  })

  it('Meganium makes Basic {G} Energy provide {G}{G}, without stacking', () => {
    const s = setup({ p0: { active: { card: 'MEG-8', energy: [E.G] }, bench: [{ card: 'MEG-10', under: ['MEG-8', 'MEG-9'] }, { card: 'MEG-10', under: ['MEG-8', 'MEG-9'] }] }, p1: { active: GOLDEEN } })
    expect(energyAlternatives(ctx(s), s.players[0].active!, s.players[0].active!.energy[0])).toEqual([['Grass', 'Grass']])
  })

  it('Hydrapple ex attaches a {G} from hand and heals 30', () => {
    const s = setup({ p0: { active: { card: 'SCR-14', under: ['SCR-12'], damage: 50 }, hand: [E.G] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Ripening Charge')
    expect([after.players[0].active!.energy.length, after.players[0].active!.damage]).toEqual([1, 20])
  })

  it('Dipplin attacks twice with Festival Grounds after a Knock Out', () => {
    const s = setup({ stadium: 'TWM-149', p0: { active: { card: 'TWM-18', under: ['TWM-17'], energy: [E.G] }, bench: [GOLDEEN, GOLDEEN, GOLDEEN] }, p1: { active: { card: GOLDEEN, damage: 10 }, bench: [{ card: GOLDEEN, damage: 10 }, { card: GOLDEEN, damage: 10 }] } })
    const after = act(s, 'Do the Wave', answers(undefined, [1]))
    expect(after.players[0].prizes).toHaveLength(4)
    expect(after.turnPlayer).toBe(1)
  })
})

describe('Metal and Psychic', () => {
  it('Mega Excadrill ex does 130 more with 2 extra Energy', () => {
    const five = act(setup({ p0: { active: { card: 'PBL-65', under: ['PBL-46'], energy: [E.M, E.M, E.M, E.M, E.M] } }, p1: { active: 'MEG-104', bench: [GOLDEEN] } }), 'Maximum Drilling')
    expect(five.players[0].prizes).toHaveLength(3)
    const four = act(setup({ p0: { active: { card: 'PBL-65', under: ['PBL-46'], energy: [E.M, E.M, E.M, E.M] } }, p1: { active: 'MEG-104', bench: [GOLDEEN] } }), 'Maximum Drilling')
    expect(four.players[1].active!.damage).toBe(200)
  })

  it('Metang attaches Basic {M} Energy from the top 4 cards', () => {
    const s = setup({ p0: { active: { card: 'TEF-114', under: ['TEF-113'] }, deck: [E.M, E.P, E.M, E.P, E.R] }, p1: { active: GOLDEEN } })
    const after = ability(s, s.players[0].active!.id, 'Metal Maker')
    expect(after.players[0].active!.energy).toHaveLength(2)
    expect(ids(after, after.players[0].deck.slice(0, 1))).toEqual([E.R])
  })

  it('Shaymin protects Benched Pokémon without a Rule Box', () => {
    const s = setup({ p0: { active: { card: 'ASC-142', energy: [E.D, E.D, E.D] } }, p1: { active: GOLDEEN, bench: ['DRI-10', 'POR-62'] } })
    const [shaymin, meowth] = s.players[1].bench.map(b => b.id)
    expect(act(s, 'Cruel Arrow', answers([shaymin])).players[1].bench[0].damage).toBe(0)
    expect(act(s, 'Cruel Arrow', answers([meowth])).players[1].bench[1].damage).toBe(100)
  })

  it('Alakazam draws 3 when evolved from the hand', () => {
    const s = setup({ p0: { active: { card: 'MEG-55', under: ['MEG-54'] }, hand: ['MEG-56'] }, p1: { active: GOLDEEN } })
    const after = drive(s, { type: 'evolve', card: s.players[0].hand[0], target: s.players[0].active!.id })
    expect(after.players[0].hand).toHaveLength(3)
  })

  it('Genesect with a Tool stops the opponent playing ACE SPEC cards', () => {
    let s = setup({ p0: { active: { card: 'SFA-40', tools: ['TEF-152'] } }, p1: { active: GOLDEEN, hand: ['TEF-157'], bench: [GOLDEEN] } })
    s = drive(s, { type: 'endTurn' })
    expect(legalActions(ctx(s)).some(a => a.type === 'playTrainer')).toBe(false)
  })

  it('Iron Thorns ex switches off Rule Box abilities while Active', () => {
    const s = setup({ p0: { active: 'TWM-77' }, p1: { active: GOLDEEN, bench: ['MEG-104', 'TWM-95'] } })
    expect(abilityOff(ctx(s), s.players[1].bench[0], 'Run Errand')).toBe(true)
    expect(abilityOff(ctx(s), s.players[1].bench[1], 'Adrena-Brain')).toBe(false)
  })

  it('Mega Rayquaza ex attaches a Basic Energy from the top 4 when benched', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['DLR-84'], deck: [E.P, E.R, E.L, E.P] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', 'DLR-84') })
    expect(s.players[0].bench[0].energy).toHaveLength(1)
  })
})
