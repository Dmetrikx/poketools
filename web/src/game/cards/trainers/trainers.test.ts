import { describe, expect, it } from 'vitest'
import { maxHp, retreatCost, energyAlternatives } from '../../engine/rules'
import { E, answers, can, canPlay, db, drive, ids, play, setup, uid } from '../testkit'

// Test Pokémon (catalog ids): vanilla attackers and tagged Pokémon.
const GOLDEEN = 'PBL-13'        // Water Basic 70, Pierce CC 30
const MAKUHITA = 'MEG-72'       // Fighting Basic 80
const BELDUM = 'CRI-59'         // Metal Basic 70
const MEOWTH_EX = 'POR-62'      // Colorless Basic ex 170
const KANGASKHAN = 'MEG-104'    // Mega ex 300
const OGERPON = 'TWM-25'        // Grass Basic ex Tera 210
const DREEPY = 'TWM-128', DRAKLOAK = 'TWM-129', DRAGAPULT = 'TWM-130'
const CHIKORITA = 'MEG-8', BAYLEEF = 'ASC-9'
const ZORUA = 'JTG-97'          // N's, Darkness
const MURKROW = 'DRI-127'       // Team Rocket's
const CLEFAIRY = 'JTG-56'       // Lillie's ex
const ABRA = 'MEG-54', KADABRA = 'MEG-55'
const ctx = (s: ReturnType<typeof setup>) => ({ s, db })
const hand = (s: ReturnType<typeof setup>, p: 0 | 1 = 0) => ids(s, s.players[p].hand)

describe('Supporters', () => {
  it("Boss's Orders brings up an opponent's Benched Pokémon", () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['MEG-114'] }, p1: { active: GOLDEEN, bench: [MEOWTH_EX] } })
    s = play(s, 'MEG-114')
    expect(ids(s, [s.players[1].active!.stack[0]])).toEqual([MEOWTH_EX])
  })

  it("Boss's Orders can't be played when the opponent has no Bench", () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['MEG-114'] }, p1: { active: GOLDEEN } })
    expect(canPlay(s, 'MEG-114')).toBe(false)
  })

  it("Lillie's Determination draws 8 with 6 Prizes left, 6 otherwise", () => {
    const six = play(setup({ p0: { active: GOLDEEN, hand: ['MEG-119', E.P] }, p1: { active: GOLDEEN } }), 'MEG-119')
    expect(six.players[0].hand).toHaveLength(8)
    const five = play(setup({ p0: { active: GOLDEEN, hand: ['MEG-119'], prizes: 5 }, p1: { active: GOLDEEN } }), 'MEG-119')
    expect(five.players[0].hand).toHaveLength(6)
  })

  it('Judge: both players shuffle their hands in and draw 4', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['POR-76', E.P, E.P] }, p1: { active: GOLDEEN, hand: [E.D] } }), 'POR-76')
    expect(s.players[0].hand).toHaveLength(4)
    expect(s.players[1].hand).toHaveLength(4)
  })

  it("Iris's Fighting Spirit discards a card, then draws to 6", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['JTG-149', E.R, E.R] }, p1: { active: GOLDEEN } }), 'JTG-149')
    expect(s.players[0].hand).toHaveLength(6)
    expect(ids(s, s.players[0].discard).sort()).toEqual(['JTG-149', E.R].sort())
  })

  it('Crispin puts 1 Basic Energy in hand and attaches another type', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['SCR-133'], deck: [E.R, E.R, E.W, E.P] }, p1: { active: GOLDEEN } }), 'SCR-133')
    expect(s.players[0].hand).toHaveLength(1)
    expect(s.players[0].active!.energy).toHaveLength(1)
    expect(new Set([...hand(s), ...ids(s, s.players[0].active!.energy)]).size).toBe(2)
  })

  it('Dawn finds a Basic, a Stage 1 and a Stage 2', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['PFL-87'], deck: [DRAGAPULT, E.P, DREEPY, DRAKLOAK] }, p1: { active: GOLDEEN } }), 'PFL-87')
    expect(hand(s).sort()).toEqual([DREEPY, DRAKLOAK, DRAGAPULT].sort())
  })

  it('Carmine can be played on the first turn of the player going first', () => {
    const s = setup({ turn: 1, p0: { active: GOLDEEN, hand: ['TWM-145', 'MEG-119'] }, p1: { active: GOLDEEN } })
    expect(canPlay(s, 'TWM-145')).toBe(true)
    expect(canPlay(s, 'MEG-119')).toBe(false)
    expect(play(s, 'TWM-145').players[0].hand).toHaveLength(5)
  })

  it("Black Belt's Training adds 40 to an attack on the opponent's Active ex", () => {
    let s = setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] }, hand: ['JTG-143'] }, p1: { active: KANGASKHAN } })
    s = play(s, 'JTG-143')
    s = drive(s, { type: 'attack', attack: 'Pierce' })
    expect(s.players[1].active!.damage).toBe(70)
  })

  it('Briar takes 1 more Prize when a Tera Pokémon Knocks Out the Active', () => {
    let s = setup({ p0: { active: { card: OGERPON, energy: [E.G, E.G, E.G] }, hand: ['SCR-132'] }, p1: { active: { card: GOLDEEN, damage: 40 }, bench: [GOLDEEN], prizes: 2 } })
    s = play(s, 'SCR-132')
    s = drive(s, { type: 'attack', attack: 'Myriad Leaf Shower' })
    expect(s.players[0].prizes).toHaveLength(4)
  })

  it("AZ's Tranquility heals 80 from a Pokémon ex it moves to the Bench", () => {
    const s = play(setup({ p0: { active: { card: MEOWTH_EX, damage: 100 }, bench: [GOLDEEN], hand: ['CRI-76'] }, p1: { active: GOLDEEN } }), 'CRI-76')
    expect(s.players[0].bench[0].damage).toBe(20)
  })

  it("Bianca's Devotion needs a Pokémon at 30 HP or less and heals it fully", () => {
    expect(canPlay(setup({ p0: { active: { card: GOLDEEN, damage: 30 }, hand: ['TEF-142'] }, p1: { active: GOLDEEN } }), 'TEF-142')).toBe(false)
    const s = play(setup({ p0: { active: { card: GOLDEEN, damage: 40 }, hand: ['TEF-142'] }, p1: { active: GOLDEEN } }), 'TEF-142')
    expect(s.players[0].active!.damage).toBe(0)
  })

  it('Eri discards up to 2 Items from the opponent\'s hand', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-146'] }, p1: { active: GOLDEEN, hand: ['MEG-131', 'MEG-130', 'MEG-114'] } }), 'TEF-146')
    expect(hand(s, 1)).toEqual(['MEG-114'])
  })

  it("N's Plan moves up to 2 Energy from the Bench to the Active", () => {
    const s = play(setup({ p0: { active: GOLDEEN, bench: [{ card: GOLDEEN, energy: [E.W, E.W, E.W] }], hand: ['BLK-83'] }, p1: { active: GOLDEEN } }), 'BLK-83')
    expect(s.players[0].active!.energy).toHaveLength(2)
  })

  it("Xerosic's Machinations: the opponent discards down to 3", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['SFA-64'] }, p1: { active: GOLDEEN, hand: [E.P, E.P, E.P, E.P, E.P, E.P] } }), 'SFA-64')
    expect(s.players[1].hand).toHaveLength(3)
  })

  it("Zinnia's Trust moves an Energy from the old Active to the new one", () => {
    const s = play(setup({ p0: { active: { card: GOLDEEN, energy: [E.W] }, bench: [MAKUHITA], hand: ['DLR-103'] }, p1: { active: GOLDEEN } }), 'DLR-103')
    expect(ids(s, [s.players[0].active!.id])).toEqual([MAKUHITA])
    expect(s.players[0].active!.energy).toHaveLength(1)
  })

  it("Team Rocket's Archer needs a Team Rocket's Pokémon Knocked Out last turn", () => {
    const s = setup({ p0: { active: MURKROW, hand: ['DRI-170'] }, p1: { active: GOLDEEN } })
    expect(canPlay(s, 'DRI-170')).toBe(false)
    s.history.push({ turn: 2, player: 1, knockOuts: [{ slot: 999, owner: 0, cardId: MURKROW, byAttack: true }], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
    expect(canPlay(s, 'DRI-170')).toBe(true)
  })

  it('Salvatore evolves a Pokémon put into play this turn', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: [CHIKORITA, 'TEF-160'], deck: [BAYLEEF, E.G] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', CHIKORITA) })
    s = play(s, 'TEF-160')
    expect(ids(s, s.players[0].bench[0].stack)).toEqual([CHIKORITA, BAYLEEF])
  })

  it("Gladion's Final Battle needs to be the last card in hand", () => {
    expect(canPlay(setup({ p0: { active: GOLDEEN, hand: ['PBL-77', E.P] }, p1: { active: GOLDEEN } }), 'PBL-77')).toBe(false)
    let s = setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] }, hand: ['PBL-77'] }, p1: { active: MEOWTH_EX, bench: [GOLDEEN] } })
    s = play(s, 'PBL-77')
    s = drive(s, { type: 'attack', attack: 'Pierce' })
    expect(s.players[1].bench.find(b => s.cards[b.id].cardId === MEOWTH_EX)?.damage ?? s.players[1].active!.damage).toBe(110)
  })

  it("Acerola's Mischief stops damage from the opponent's Pokémon ex", () => {
    let s = setup({ turnPlayer: 0, p0: { active: GOLDEEN, hand: ['MEG-113'] }, p1: { active: { card: MEOWTH_EX, energy: [E.W, E.W, E.W] }, prizes: 2 } })
    s = play(s, 'MEG-113')
    s = drive(s, { type: 'endTurn' })
    s = drive(s, { type: 'attack', attack: 'Tuck Tail' })
    expect(s.players[0].active!.damage).toBe(0)
  })

  it('Ciphermaniac puts 2 searched cards on top in the chosen order', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-145'], deck: [E.P, E.P, E.R, E.W] } , p1: { active: GOLDEEN } }), 'TEF-145', answers(undefined, undefined))
    expect(s.players[0].deck).toHaveLength(4)
    expect(s.players[0].hand).toHaveLength(0)
  })

  it("Explorer's Guidance takes 2 of the top 6 and discards the rest", () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-147'] }, p1: { active: GOLDEEN } }), 'TEF-147')
    expect(s.players[0].hand).toHaveLength(2)
    expect(s.players[0].discard).toHaveLength(5)
  })
})

describe('Items', () => {
  it('Ultra Ball discards 2 cards and searches for a Pokémon', () => {
    let s = setup({ p0: { active: GOLDEEN, hand: ['MEG-131', E.P] }, p1: { active: GOLDEEN } })
    expect(canPlay(s, 'MEG-131')).toBe(false)
    s = setup({ p0: { active: GOLDEEN, hand: ['MEG-131', E.P, E.R], deck: [E.P, DREEPY] }, p1: { active: GOLDEEN } })
    s = play(s, 'MEG-131')
    expect(hand(s)).toEqual([DREEPY])
  })

  it('Buddy-Buddy Poffin benches Basics with 70 HP or less only', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-144'], deck: [MEOWTH_EX, DREEPY, MAKUHITA, GOLDEEN] }, p1: { active: GOLDEEN } }), 'TEF-144')
    expect(ids(s, s.players[0].bench.map(b => b.id)).sort()).toEqual([DREEPY, GOLDEEN].sort())
  })

  it('Rare Candy evolves a Basic straight to its Stage 2', () => {
    const s = play(setup({ p0: { active: DREEPY, hand: ['MEG-125', DRAGAPULT] }, p1: { active: GOLDEEN } }), 'MEG-125')
    expect(ids(s, s.players[0].active!.stack)).toEqual([DREEPY, DRAGAPULT])
  })

  it("Rare Candy can't be used on a Basic put into play this turn or on your first turn", () => {
    expect(canPlay(setup({ p0: { active: { card: DREEPY, entered: 3 }, hand: ['MEG-125', DRAGAPULT] }, p1: { active: GOLDEEN } }), 'MEG-125')).toBe(false)
    expect(canPlay(setup({ turn: 1, p0: { active: { card: DREEPY, entered: 0 }, hand: ['MEG-125', DRAGAPULT] }, p1: { active: GOLDEEN } }), 'MEG-125')).toBe(false)
  })

  it('Night Stretcher returns a Pokémon or Basic Energy', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['ASC-196'], discard: ['MEG-114', DREEPY] }, p1: { active: GOLDEEN } }), 'ASC-196')
    expect(hand(s)).toEqual([DREEPY])
  })

  it('Energy Switch moves a Basic Energy between your Pokémon', () => {
    const s = play(setup({ p0: { active: GOLDEEN, bench: [{ card: GOLDEEN, energy: [E.W] }], hand: ['MEG-115'] }, p1: { active: GOLDEEN } }), 'MEG-115')
    expect(s.players[0].active!.energy).toHaveLength(1)
  })

  it('Prime Catcher switches both Active Pokémon', () => {
    const s = play(setup({ p0: { active: GOLDEEN, bench: [MAKUHITA], hand: ['TEF-157'] }, p1: { active: GOLDEEN, bench: [MEOWTH_EX] } }), 'TEF-157')
    expect(ids(s, [s.players[1].active!.id, s.players[0].active!.id])).toEqual([MEOWTH_EX, MAKUHITA])
  })

  it('Unfair Stamp needs a Knock Out last turn; then hands go to 5 and 2', () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['TWM-165'] }, p1: { active: GOLDEEN, hand: [E.P] } })
    expect(canPlay(s, 'TWM-165')).toBe(false)
    s.history.push({ turn: 2, player: 1, knockOuts: [{ slot: 999, owner: 0, cardId: GOLDEEN, byAttack: true }], attacks: [], movedToActive: [], supporters: [], abilities: [], stadiumUsed: false })
    const after = play(s, 'TWM-165')
    expect([after.players[0].hand.length, after.players[1].hand.length]).toEqual([5, 2])
  })

  it('Secret Box finds one of each Trainer kind', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TWM-163', E.P, E.P, E.P], deck: ['MEG-130', 'TEF-152', 'MEG-114', 'MEG-127', E.P] }, p1: { active: GOLDEEN } }), 'TWM-163')
    expect(hand(s).sort()).toEqual(['MEG-130', 'TEF-152', 'MEG-114', 'MEG-127'].sort())
  })

  it('Special Red Card needs the opponent at 3 Prizes or fewer', () => {
    expect(canPlay(setup({ p0: { active: GOLDEEN, hand: ['CRI-82'] }, p1: { active: GOLDEEN, prizes: 4 } }), 'CRI-82')).toBe(false)
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['CRI-82'] }, p1: { active: GOLDEEN, prizes: 3, hand: [E.P, E.P, E.P, E.P, E.P, E.P] } }), 'CRI-82')
    expect(s.players[1].hand).toHaveLength(3)
  })

  it('Tasty Rice Ball heals 30 more for each other Tasty Rice Ball in the discard pile', () => {
    const s = play(setup({ p0: { active: { card: MEOWTH_EX, damage: 150 }, hand: ['DLR-101'], discard: ['DLR-101', 'DLR-101'] }, p1: { active: GOLDEEN } }), 'DLR-101')
    expect(s.players[0].active!.damage).toBe(60)
  })

  it('Strange Timepiece devolves a {P} Pokémon into the hand', () => {
    const s = play(setup({ p0: { active: { card: KADABRA, under: [ABRA] }, hand: ['MEG-128'] }, p1: { active: GOLDEEN } }), 'MEG-128')
    expect(ids(s, s.players[0].active!.stack)).toEqual([ABRA])
    expect(hand(s)).toEqual([KADABRA])
  })

  it('Redeemable Ticket keeps the Prize count and every card', () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['JTG-156'], prizes: 4 }, p1: { active: GOLDEEN } })
    const after = play(s, 'JTG-156')
    expect(after.players[0].prizes).toHaveLength(4)
    expect(after.players[0].deck).toHaveLength(20)
  })

  it('Scoop Up Cyclone returns a Pokémon and its cards to the hand', () => {
    const s = play(setup({ p0: { active: { card: MEOWTH_EX, energy: [E.P] }, bench: [GOLDEEN], hand: ['TWM-162'] }, p1: { active: GOLDEEN } }), 'TWM-162')
    expect(hand(s).sort()).toEqual([MEOWTH_EX, E.P].sort())
    expect(ids(s, [s.players[0].active!.id])).toEqual([GOLDEEN])
  })

  it('Hand Trimmer: both players discard down to 5', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['TEF-150', E.P, E.P, E.P, E.P, E.P, E.P] }, p1: { active: GOLDEEN, hand: [E.D, E.D, E.D, E.D, E.D, E.D, E.D] } }), 'TEF-150')
    expect([s.players[0].hand.length, s.players[1].hand.length]).toEqual([5, 5])
  })

  it('Crushing Hammer discards an Energy only on heads', () => {
    for (let seed = 1; seed < 12; seed++) {
      const s = play(setup({ seed, p0: { active: GOLDEEN, hand: ['POR-71'] }, p1: { active: { card: GOLDEEN, energy: [E.W] } } }), 'POR-71')
      const heads = s.log.some(l => l.text.includes('heads'))
      expect(s.players[1].active!.energy.length).toBe(heads ? 0 : 1)
    }
  })

  it('Iron Defender reduces damage to your {M} Pokémon during the opponent\'s next turn', () => {
    let s = setup({ p0: { active: BELDUM, hand: ['MEG-118'] }, p1: { active: { card: GOLDEEN, energy: [E.W, E.W] } } })
    s = play(s, 'MEG-118')
    s = drive(s, { type: 'endTurn' })
    s = drive(s, { type: 'attack', attack: 'Pierce' })
    expect(s.players[0].active!.damage).toBe(0)
  })

  it('Blowtorch costs a Basic {R} Energy and discards the Stadium', () => {
    const s = play(setup({ stadium: 'MEG-127', p0: { active: GOLDEEN, hand: ['PFL-86', E.R] }, p1: { active: GOLDEEN } }), 'PFL-86')
    expect(s.stadium).toBeNull()
  })

  it('Tool Scrapper discards Tools from either side', () => {
    const s = play(setup({ p0: { active: { card: GOLDEEN, tools: ['TEF-152'] }, hand: ['ASC-212'] }, p1: { active: { card: GOLDEEN, tools: ['ASC-181'] } } }), 'ASC-212')
    expect([s.players[0].active!.tools.length, s.players[1].active!.tools.length]).toEqual([0, 0])
  })

  it('Precious Trolley benches any number of Basics', () => {
    const s = play(setup({ p0: { active: GOLDEEN, hand: ['SSP-185'], deck: [DREEPY, DREEPY, MEOWTH_EX, E.P] }, p1: { active: GOLDEEN } }), 'SSP-185')
    expect(s.players[0].bench).toHaveLength(3)
  })
})

describe('Tools', () => {
  it("Hero's Cape adds 100 HP; Air Balloon removes {C}{C} of Retreat Cost", () => {
    const s = setup({ p0: { active: { card: GOLDEEN, tools: ['TEF-152'] }, bench: [{ card: MAKUHITA, tools: ['ASC-181'] }] }, p1: { active: GOLDEEN } })
    expect(maxHp(ctx(s), s.players[0].active!)).toBe(170)
    expect(retreatCost(ctx(s), s.players[0].bench[0])).toBe(0)
  })

  it('Survival Brace keeps a full-HP Pokémon at 10 HP once, then is discarded', () => {
    const big = setup({ p0: { active: { card: KANGASKHAN, energy: [E.P, E.P, E.P] } }, p1: { active: { card: GOLDEEN, tools: ['TWM-164'], damage: 0 }, bench: [GOLDEEN] } })
    const after = drive(big, { type: 'attack', attack: 'Rapid-Fire Combo' })
    expect(after.players[1].active!.damage).toBe(60)
    expect(after.players[1].active!.tools).toHaveLength(0)
    expect(after.players[0].prizes).toHaveLength(6)
  })

  it('Lucky Helmet draws 2 when its Active Pokémon is damaged', () => {
    const s = drive(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: MEOWTH_EX, tools: ['TWM-158'] } } }), { type: 'attack', attack: 'Pierce' })
    expect(s.players[1].hand).toHaveLength(3)
  })

  it('Punk Helmet puts 4 damage counters on the attacker of a {D} Pokémon', () => {
    const s = drive(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: ZORUA, tools: ['PFL-92'] } } }), { type: 'attack', attack: 'Pierce' })
    expect(s.players[0].active!.damage).toBe(40)
  })

  it("Lillie's Pearl gives up 1 fewer Prize for a Lillie's Pokémon", () => {
    const s = drive(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: CLEFAIRY, tools: ['JTG-151'], damage: 170 }, bench: [GOLDEEN] } }), { type: 'attack', attack: 'Pierce' })
    expect(s.players[0].prizes).toHaveLength(5)
  })

  it('Gravity Gemstone adds {C} to both Active Pokémon\'s Retreat Cost', () => {
    const s = setup({ p0: { active: { card: GOLDEEN, tools: ['SCR-137'] } }, p1: { active: GOLDEEN } })
    expect([retreatCost(ctx(s), s.players[0].active!), retreatCost(ctx(s), s.players[1].active!)]).toEqual([2, 2])
  })

  it('Handheld Fan moves an Energy from the attacker to its Bench', () => {
    const s = drive(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] }, bench: [MAKUHITA] }, p1: { active: { card: MEOWTH_EX, tools: ['TWM-150'] } } }), { type: 'attack', attack: 'Pierce' })
    expect([s.players[0].active!.energy.length, s.players[0].bench[0].energy.length]).toEqual([1, 1])
  })
})

describe('Stadiums', () => {
  it('Area Zero Underdepths allows 8 Benched Pokémon with a Tera in play', () => {
    const s = setup({ stadium: 'SCR-131', p0: { active: OGERPON, bench: [GOLDEEN, GOLDEEN, GOLDEEN, GOLDEEN, GOLDEEN], hand: [DREEPY] }, p1: { active: GOLDEEN } })
    expect(can(s, { type: 'playBasic', card: uid(s, 0, 'hand', DREEPY) })).toBe(true)
  })

  it('Area Zero Underdepths leaving play cuts Benches to 5', () => {
    const s = setup({ stadium: 'SCR-131', p0: { active: OGERPON, bench: [GOLDEEN, GOLDEEN, GOLDEEN, GOLDEEN, GOLDEEN, GOLDEEN], hand: ['MEG-127'] }, p1: { active: GOLDEEN } })
    expect(play(s, 'MEG-127').players[0].bench).toHaveLength(5)
  })

  it('Jamming Tower switches Tools off', () => {
    const s = setup({ stadium: 'TWM-153', p0: { active: { card: GOLDEEN, tools: ['TEF-152'] } }, p1: { active: GOLDEEN } })
    expect(maxHp(ctx(s), s.players[0].active!)).toBe(70)
  })

  it('Gravity Mountain gives Stage 2 Pokémon -30 HP', () => {
    const s = setup({ stadium: 'SSP-177', p0: { active: { card: DRAGAPULT, under: [DREEPY, DRAKLOAK] } }, p1: { active: GOLDEEN } })
    expect(maxHp(ctx(s), s.players[0].active!)).toBe(290)
  })

  it("N's Castle: N's Pokémon have no Retreat Cost", () => {
    const s = setup({ stadium: 'JTG-152', p0: { active: ZORUA }, p1: { active: GOLDEEN } })
    expect(retreatCost(ctx(s), s.players[0].active!)).toBe(0)
  })

  it('Nighttime Mine makes Tera attacks cost {C} more', () => {
    const s = setup({ stadium: 'ASC-197', p0: { active: { card: OGERPON, energy: [E.G, E.G, E.G] } }, p1: { active: GOLDEEN } })
    expect(can(s, { type: 'attack', attack: 'Myriad Leaf Shower' })).toBe(false)
  })

  it('Risky Ruins puts 2 damage counters on a non-{D} Basic played to the Bench', () => {
    let s = setup({ stadium: 'MEG-127', p0: { active: GOLDEEN, hand: [DREEPY, ZORUA] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', DREEPY) })
    s = drive(s, { type: 'playBasic', card: uid(s, 0, 'hand', ZORUA) })
    expect(s.players[0].bench.map(b => b.damage)).toEqual([20, 0])
  })

  it('Festival Grounds keeps Special Conditions off Pokémon with Energy', () => {
    const s = setup({ stadium: 'TWM-149', p0: { active: GOLDEEN, hand: [E.W] }, p1: { active: GOLDEEN } })
    s.players[0].active!.rotation = 'confused'
    expect(drive(s, { type: 'attachEnergy', card: uid(s, 0, 'hand', E.W), target: s.players[0].active!.id }).players[0].active!.rotation).toBeNull()
  })

  it('Lumiose City benches a Basic and ends the turn', () => {
    const s = drive(setup({ stadium: 'POR-77', p0: { active: GOLDEEN, deck: [DREEPY, E.P, E.P] }, p1: { active: GOLDEEN } }), { type: 'stadiumAction' })
    expect(s.players[0].bench).toHaveLength(1)
    expect(s.turnPlayer).toBe(1)
  })

  it('Prism Tower: discard 2, draw 1, once per turn', () => {
    const s = drive(setup({ stadium: 'CRI-80', p0: { active: GOLDEEN, hand: [E.P, E.P] }, p1: { active: GOLDEEN } }), { type: 'stadiumAction' })
    expect(s.players[0].hand).toHaveLength(1)
    expect(can(s, { type: 'stadiumAction' })).toBe(false)
  })

  it('Grand Tree evolves a Basic to Stage 1 then Stage 2 from the deck', () => {
    const s = drive(setup({ stadium: 'SCR-136', p0: { active: DREEPY, deck: [DRAKLOAK, DRAGAPULT, E.P] }, p1: { active: GOLDEEN } }), { type: 'stadiumAction' })
    expect(ids(s, s.players[0].active!.stack)).toEqual([DREEPY, DRAKLOAK, DRAGAPULT])
  })

  it('Battle Cage stops damage counters from the opponent\'s attacks landing on the Bench', async () => {
    const { placeCounters } = await import('../../effects/ops')
    const s = setup({ stadium: 'PFL-85', p0: { active: GOLDEEN }, p1: { active: GOLDEEN, bench: [GOLDEEN] } })
    const x = { s, db, me: 0 as const, opp: 1 as const, self: s.players[0].active, card: null, effect: 'attack' as const }
    expect(placeCounters(x, s.players[1].bench[0], 3)).toBe(0)
    expect(placeCounters(x, s.players[1].active!, 3)).toBe(3)
  })

  it('Team Rocket\'s Watchtower and Legendary Pyroduct switch abilities off', async () => {
    const { abilityOff } = await import('../../engine/modifiers')
    const s = setup({ stadium: 'DRI-180', p0: { active: MEOWTH_EX }, p1: { active: GOLDEEN } })
    expect(abilityOff(ctx(s), s.players[0].active!, 'Last-Ditch Catch')).toBe(true)
    const p = setup({ stadium: 'DLR-94', p0: { active: { card: DRAKLOAK, under: [DREEPY] } }, p1: { active: GOLDEEN } })
    expect(abilityOff(ctx(p), p.players[0].active!, 'Recon Directive')).toBe(true)
  })
})

describe('Special Energy', () => {
  it('Prism Energy provides any type on a Basic, {C} otherwise', () => {
    const s = setup({ p0: { active: { card: GOLDEEN, energy: ['ASC-216'] }, bench: [{ card: DRAKLOAK, under: [DREEPY], energy: ['ASC-216'] }] }, p1: { active: GOLDEEN } })
    expect(energyAlternatives(ctx(s), s.players[0].active!, s.players[0].active!.energy[0])).toEqual([['Any']])
    expect(energyAlternatives(ctx(s), s.players[0].bench[0], s.players[0].bench[0].energy[0])).toEqual([['Colorless']])
  })

  it("Team Rocket's Energy attaches only to Team Rocket's Pokémon and provides 2", () => {
    const s = setup({ p0: { active: GOLDEEN, bench: [MURKROW], hand: ['DRI-182'] }, p1: { active: GOLDEEN } })
    const e = uid(s, 0, 'hand', 'DRI-182')
    expect(can(s, { type: 'attachEnergy', card: e, target: s.players[0].active!.id })).toBe(false)
    expect(can(s, { type: 'attachEnergy', card: e, target: s.players[0].bench[0].id })).toBe(true)
  })

  it('Enriching Energy draws 4 when attached from hand', () => {
    const s = setup({ p0: { active: GOLDEEN, hand: ['SSP-191'] }, p1: { active: GOLDEEN } })
    const after = drive(s, { type: 'attachEnergy', card: uid(s, 0, 'hand', 'SSP-191'), target: s.players[0].active!.id })
    expect(after.players[0].hand).toHaveLength(4)
  })

  it('Ignition Energy provides {C}{C}{C} on an Evolution and is discarded at the end of the turn', () => {
    let s = setup({ p0: { active: { card: DRAKLOAK, under: [DREEPY] }, hand: ['WHT-86'] }, p1: { active: GOLDEEN } })
    s = drive(s, { type: 'attachEnergy', card: uid(s, 0, 'hand', 'WHT-86'), target: s.players[0].active!.id })
    expect(energyAlternatives(ctx(s), s.players[0].active!, s.players[0].active!.energy[0])).toEqual([['Colorless', 'Colorless', 'Colorless']])
    s = drive(s, { type: 'endTurn' })
    expect(s.players[0].active!.energy).toHaveLength(0)
  })

  it('Telepathic Psychic Energy benches up to 2 Basic {P} Pokémon', () => {
    const s = setup({ p0: { active: ABRA, hand: ['POR-88'], deck: [ABRA, ABRA, E.P] }, p1: { active: GOLDEEN } })
    expect(drive(s, { type: 'attachEnergy', card: uid(s, 0, 'hand', 'POR-88'), target: s.players[0].active!.id }).players[0].bench).toHaveLength(2)
  })

  it('Legacy Energy saves a Prize only once per game', () => {
    const ko = (s: ReturnType<typeof setup>) => drive(s, { type: 'attack', attack: 'Pierce' })
    const a = ko(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: MEOWTH_EX, energy: ['TWM-167'], damage: 150 }, bench: [GOLDEEN] } }))
    expect(a.players[0].prizes).toHaveLength(5)
    const used = setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: MEOWTH_EX, energy: ['TWM-167'], damage: 150 }, bench: [GOLDEEN] } })
    used.usedOnce.push('legacy:1')
    expect(ko(used).players[0].prizes).toHaveLength(4)
  })

  it('Spiky Energy puts 2 damage counters on the attacker', () => {
    const s = drive(setup({ p0: { active: { card: GOLDEEN, energy: [E.W, E.W] } }, p1: { active: { card: MEOWTH_EX, energy: ['JTG-159'] } } }), { type: 'attack', attack: 'Pierce' })
    expect(s.players[0].active!.damage).toBe(20)
  })

  it('Growing Grass Energy gives a {G} Pokémon +20 HP', () => {
    const s = setup({ p0: { active: { card: CHIKORITA, energy: ['POR-86'] } }, p1: { active: GOLDEEN } })
    expect(maxHp(ctx(s), s.players[0].active!)).toBe(90)
  })
})
