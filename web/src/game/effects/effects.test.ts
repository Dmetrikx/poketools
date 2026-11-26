import { describe, expect, it } from 'vitest'
import { actionKey, legalActions } from '../engine/actions'
import { runStep } from '../engine/game'
import type { CardImpl, MarkerImpl } from '../engine/impl'
import { energyAlternatives, maxHp, retreatCost } from '../engine/rules'
import { attack, dbFrom, energy, implsFrom, pokemon, scenario, trainer } from '../engine/testing'
import type { Action, Answer, Ctx, GameState, Proc } from '../engine/types'
import {
  addMarker, applyCondition, damage, damageActive, discardFromHand, draw, endTheTurn, heal, may, placeCounters,
  putOntoBench, searchToBench, searchToHand, sel, useAttackOf,
} from './index'
import { teraRule } from '../cards/rules'

// Synthetic cards exercise each hook the real cards will use.

const FIRE = energy('Fire')
const GRASS = energy('Grass')
const cards = [
  FIRE, GRASS,
  pokemon('A', { name: 'Attacker', hp: 100, types: ['Fire'], attacks: [attack('Hit', ['Colorless'], 30), attack('Burn It', ['Colorless'], 10, 'burn')] }),
  pokemon('D', { name: 'Defender', hp: 100, types: ['Water'], weakness: { type: 'Fire', value: '×2' }, attacks: [attack('Tap', [], 10)] }),
  pokemon('D2', { name: 'Defender2', subtype: 'Stage 1', evolveFrom: 'Defender', hp: 150, types: ['Water'], abilities: [{ name: 'Evolve Draw', text: '' }], attacks: [attack('Tap', [], 10)] }),
  pokemon('Lock', { name: 'Locker', hp: 90, types: ['Psychic'], abilities: [{ name: 'Silence', text: '' }], attacks: [] }),
  pokemon('Drawer', { name: 'Drawer', hp: 90, types: ['Colorless'], abilities: [{ name: 'Draw 1', text: '' }], attacks: [attack('Tap', [], 10)] }),
  pokemon('Drawer2', { name: 'Drawer Two', hp: 90, types: ['Colorless'], abilities: [{ name: 'Draw 1', text: '' }], attacks: [] }),
  pokemon('Copier', { name: 'Copier', hp: 100, types: ['Darkness'], attacks: [attack('Copy', ['Colorless'], '', 'copy')] }),
  pokemon('Sniper', { name: 'Sniper', hp: 100, types: ['Psychic'], attacks: [attack('Snipe', [], '', 'bench')] }),
  pokemon('Twice', { name: 'Twice', hp: 100, types: ['Water'], abilities: [{ name: 'Festival', text: '' }], attacks: [attack('Splash', [], 100)] }),
  pokemon('Tera', { name: 'Tera Mon', hp: 200, types: ['Grass'], tags: ['ex', 'Tera'], attacks: [] }),
  pokemon('Hand', { name: 'Hand Mon', hp: 90, types: ['Colorless'], abilities: [{ name: 'Dive', text: '' }], attacks: [] }),
  trainer('Draw2', 'Item'), trainer('Ball', 'Item'), trainer('Sup', 'Supporter'), trainer('FirstSup', 'Supporter'),
  trainer('Cape', 'Tool'), trainer('Balloon', 'Tool'), trainer('Spiky', 'Tool'), trainer('Vest', 'Tool'), trainer('Brace', 'Tool'), trainer('Pearl', 'Tool'),
  trainer('Quiet', 'Stadium'), trainer('Lumi', 'Stadium'), trainer('Zone', 'Stadium'), trainer('Fest', 'Stadium'),
  { ...energy('Colorless'), id: 'Rainbow', name: 'Rainbow Energy', subtype: 'Special' as const, energyType: undefined },
]

const impls: Record<string, CardImpl> = {
  Draw2: { trainer: { *play(x) { draw(x, 2) } } },
  Ball: {
    trainer: {
      canPlay: x => x.s.players[x.me].hand.length >= 2,
      *play(x) {
        yield* discardFromHand(x, { min: 1, max: 1 })
        yield* searchToHand(x, { filter: sel.pokemon, title: 'Search' })
      },
    },
  },
  Sup: { trainer: { *play(x) { draw(x, 1) } } },
  FirstSup: { trainer: { firstTurn: true, *play(x) { draw(x, 1) } } },
  Cape: { trainer: { modifiers: { hp: (src, _ctx, slot) => (src.slot?.id === slot.id ? 100 : 0) } } },
  Balloon: { trainer: { modifiers: { retreatCost: (src, _c, slot) => (src.slot?.id === slot.id ? 'none' : 0) } } },
  Vest: { trainer: { modifiers: { damageTaken: (src, _c, ev) => (src.slot?.id === ev.target.id ? 20 : 0) } } },
  Brace: {
    trainer: {
      modifiers: {
        survive: (src, _c, ev, before) => src.slot?.id === ev.target.id && before === 0,
      },
    },
  },
  Pearl: { trainer: { modifiers: { prizes: (src, _c, ko) => (src.slot?.id === ko.slot.id ? -1 : 0) } } },
  Spiky: {
    trainer: {
      on: {
        damagedByAttack(x, ev) {
          if (ev.target.id === x.self?.id) placeCounters(x, ev.attacker, 2)
        },
      },
    },
  },
  Quiet: { trainer: { modifiers: { noAbilities: () => true } } },
  Lumi: {
    trainer: {
      action: {
        canUse: x => x.s.players[x.me].deck.length > 0,
        *run(x) {
          yield* searchToBench(x, { filter: sel.basicPokemon, max: 1, title: 'Bench' })
          endTheTurn(x)
        },
      },
    },
  },
  Zone: { trainer: { modifiers: { benchSize: () => 8 } } },
  Fest: {},
  Rainbow: { energy: { provides: () => [['Any']] } },
  A: {
    attacks: {
      *'Burn It'(a) {
        damageActive(a, a.base)
        if (a.defender) applyCondition(a, a.defender, 'burned')
        addMarker(a, 'noAttack', { until: 'myNextTurn', slot: a.attacker })
      },
    },
  },
  D2: {
    abilities: {
      'Evolve Draw': {
        on: {
          *evolved(x, ev): Proc {
            if (ev.slot.id === x.self?.id && ev.fromHand && (yield* may(x, 'Use Evolve Draw?'))) draw(x, 2)
          },
        },
      },
    },
  },
  Lock: { abilities: { Silence: { modifiers: { noAbilities: (src, _c, slot) => slot.id !== src.slot?.id } } } },
  Drawer: { abilities: { 'Draw 1': { group: 'Draw 1', *use(x) { draw(x, 1) } } } },
  Drawer2: { abilities: { 'Draw 1': { group: 'Draw 1', *use(x) { draw(x, 1) } } } },
  Hand: { abilities: { Dive: { fromHand: true, *use(x) { yield* putOntoBench(x, x.card!) } } } },
  Sniper: { attacks: { *Snipe(a) { for (const b of a.s.players[a.opp].bench) damage(a, b, 50) } } },
  Copier: {
    attacks: {
      *Copy(a) {
        const benched = a.s.players[a.me].bench[0]
        const top = a.db.card(a.s.cards[benched.stack[benched.stack.length - 1]].cardId)
        yield* useAttackOf(a, top.id, top.attacks![0])
      },
    },
  },
  Twice: { abilities: { Festival: { modifiers: { attackAgain: (src, ctx, slot, ko) => src.slot?.id === slot.id && ko && sel.stadiumIs(ctx, 'Fest') } } } },
}

const markerImpls: Record<string, MarkerImpl> = {
  noAttack: { modifiers: { canAttack: (src, _c, slot) => src.marker!.slot !== slot.id } },
}

const db = dbFrom(cards as never, implsFrom(impls, markerImpls, []))
const ctxOf = (s: GameState): Ctx => ({ s, db })
const run = (s: GameState, action: Action, answers: Answer[] = []) => runStep(db, s, { action, answers })
const legal = (s: GameState) => legalActions(ctxOf(s))
const has = (s: GameState, a: Action) => legal(s).some(x => actionKey(x) === actionKey(a))
const hand = (s: GameState, p: 0 | 1 = 0) => s.players[p].hand
const idOf = (s: GameState, p: 0 | 1, cardId: string) => hand(s, p).find(u => s.cards[u].cardId === cardId)!

describe('trainers', () => {
  it('plays an Item with an effect and discards it after', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'A', hand: ['Draw2'] }, p1: { active: 'D' } })
    s = run(s, { type: 'playTrainer', card: idOf(s, 0, 'Draw2') })
    expect(hand(s)).toHaveLength(2)
    expect(s.players[0].discard.map(u => s.cards[u].cardId)).toEqual(['Draw2'])
  })

  it('checks the card\'s own condition and resumes through prompts', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'A', hand: ['Ball'], deck: ['D', FIRE.id] }, p1: { active: 'D' } })
    expect(has(s, { type: 'playTrainer', card: idOf(s, 0, 'Ball') })).toBe(false)
    s = scenario({ filler: FIRE.id, p0: { active: 'A', hand: ['Ball', GRASS.id, 'Sup'], deck: ['D', FIRE.id] }, p1: { active: 'D' } })
    const ball = idOf(s, 0, 'Ball')
    const grass = idOf(s, 0, GRASS.id)
    const mid = run(s, { type: 'playTrainer', card: ball })
    expect(mid.pendingPrompt?.kind).toBe('chooseCards')
    expect(mid.players[0].hand).not.toContain(ball)
    const searchFor = s.players[0].deck[0]
    const done = run(s, { type: 'playTrainer', card: ball }, [[grass], [searchFor]])
    expect(done.players[0].hand.map(u => done.cards[u].cardId).sort()).toEqual(['D', 'Sup'])
    expect(done.players[0].discard).toContain(ball)
  })

  it('one Supporter per turn, none on the first player\'s first turn unless the card says so', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'A', hand: ['Sup', 'Sup'] }, p1: { active: 'D' } })
    s = run(s, { type: 'playTrainer', card: hand(s)[0] })
    expect(has(s, { type: 'playTrainer', card: idOf(s, 0, 'Sup') })).toBe(false)
    const first = scenario({ filler: FIRE.id, turn: 1, p0: { active: 'A', hand: ['Sup', 'FirstSup'] }, p1: { active: 'D' } })
    expect(has(first, { type: 'playTrainer', card: idOf(first, 0, 'Sup') })).toBe(false)
    expect(has(first, { type: 'playTrainer', card: idOf(first, 0, 'FirstSup') })).toBe(true)
  })
})

describe('modifiers', () => {
  it('Tools change HP and Retreat Cost of the Pokémon they are on', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', tools: ['Cape'] }, bench: [{ card: 'D', tools: ['Balloon'] }] }, p1: { active: 'D' } })
    expect(maxHp(ctxOf(s), s.players[0].active!)).toBe(200)
    expect(retreatCost(ctxOf(s), s.players[0].bench[0])).toBe(0)
    expect(retreatCost(ctxOf(s), s.players[0].active!)).toBe(1)
  })

  it('reduces damage after Weakness', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', energy: [FIRE.id] } }, p1: { active: { card: 'D', tools: ['Vest'] } } })
    expect(run(s, { type: 'attack', attack: 'Hit' }).players[1].active!.damage).toBe(40)
  })

  it('a Tool can keep a Pokémon at 10 HP, another can lower the Prizes for it', () => {
    const strong = scenario({ filler: FIRE.id, p0: { active: { card: 'Twice' } }, p1: { active: { card: 'D', tools: ['Brace'] }, bench: ['D'] } })
    const after = run(strong, { type: 'attack', attack: 'Splash' })
    expect(after.players[1].active!.damage).toBe(90)
    const pearl = scenario({ filler: FIRE.id, p0: { active: 'Twice' }, p1: { active: { card: 'D', tools: ['Pearl'] }, bench: ['D'] } })
    expect(run(pearl, { type: 'attack', attack: 'Splash' }).players[0].prizes).toHaveLength(6)
  })

  it('Tera Pokémon on the Bench take no attack damage (built-in rule)', () => {
    const withRule = dbFrom(cards as never, implsFrom(impls, markerImpls, [teraRule]))
    const s = scenario({ filler: FIRE.id, p0: { active: 'Sniper' }, p1: { active: 'D', bench: ['Tera', 'D'] } })
    const after = runStep(withRule, s, { action: { type: 'attack', attack: 'Snipe' }, answers: [] })
    expect(after.players[1].bench.map(b => b.damage)).toEqual([0, 50])
  })

  it('Special Energy can provide any type', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', energy: ['Rainbow'] } }, p1: { active: 'D' } })
    expect(energyAlternatives(ctxOf(s), s.players[0].active!, s.players[0].active!.energy[0])).toEqual([['Any']])
  })

  it('a Stadium can lift the Bench limit', () => {
    const s = scenario({ filler: FIRE.id, stadium: 'Zone', p0: { active: 'A', bench: ['D', 'D', 'D', 'D', 'D'], hand: ['D'] }, p1: { active: 'D' } })
    expect(has(s, { type: 'playBasic', card: hand(s)[0] })).toBe(true)
  })
})

describe('abilities', () => {
  it('once per turn, and once between abilities that share a group', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'Drawer', bench: ['Drawer2'] }, p1: { active: 'D' } })
    const a = s.players[0].active!.id
    const b = s.players[0].bench[0].id
    expect(has(s, { type: 'useAbility', source: a, ability: 'Draw 1' })).toBe(true)
    s = run(s, { type: 'useAbility', source: a, ability: 'Draw 1' })
    expect(hand(s)).toHaveLength(1)
    expect(has(s, { type: 'useAbility', source: a, ability: 'Draw 1' })).toBe(false)
    expect(has(s, { type: 'useAbility', source: b, ability: 'Draw 1' })).toBe(false)
  })

  it('a Stadium lock switches abilities off, including locking ones', () => {
    const s = scenario({ filler: FIRE.id, stadium: 'Quiet', p0: { active: 'Drawer' }, p1: { active: 'D' } })
    expect(legal(s).some(a => a.type === 'useAbility')).toBe(false)
  })

  it('an ability lock from a Pokémon applies, except to itself', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Drawer' }, p1: { active: 'Lock' } })
    expect(legal(s).some(a => a.type === 'useAbility')).toBe(false)
  })

  it('a triggered ability asks when its Pokémon evolves from the hand', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'D', hand: ['D2'] }, p1: { active: 'A' } })
    const mid = run(s, { type: 'evolve', card: hand(s)[0], target: s.players[0].active!.id })
    expect(mid.pendingPrompt?.kind).toBe('yesNo')
    s = run(s, { type: 'evolve', card: hand(s)[0], target: s.players[0].active!.id }, [[1]])
    expect(hand(s)).toHaveLength(2)
  })
})

describe('abilities from the hand', () => {
  it('can put the card itself onto the Bench', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'A', hand: ['Hand'] }, p1: { active: 'D' } })
    const uid = hand(s)[0]
    expect(has(s, { type: 'useAbility', source: uid, ability: 'Dive' })).toBe(true)
    s = run(s, { type: 'useAbility', source: uid, ability: 'Dive' })
    expect(s.players[0].bench.map(b => b.id)).toEqual([uid])
  })
})

describe('attacks', () => {
  it('leaves a marker that stops the attacker next turn, and burns the defender', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', energy: [FIRE.id] } }, p1: { active: 'D' } })
    s = run(s, { type: 'attack', attack: 'Burn It' })
    expect(s.players[1].active!.burned).toBe(true)
    s = run(s, { type: 'endTurn' })
    expect(s.turnPlayer).toBe(0)
    expect(has(s, { type: 'attack', attack: 'Hit' })).toBe(false)
    s = run(s, { type: 'endTurn' })
    s = run(s, { type: 'endTurn' })
    expect(has(s, { type: 'attack', attack: 'Hit' })).toBe(true)
  })

  it('copies another Pokémon\'s attack, and its damage triggers the defender\'s Tool', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'Copier', energy: [FIRE.id] }, bench: ['A'] }, p1: { active: { card: 'D', tools: ['Spiky'] } } })
    const after = run(s, { type: 'attack', attack: 'Copy' })
    expect(after.players[1].active!.damage).toBe(30)
    expect(after.players[0].active!.damage).toBe(20)
  })

  it('attacks again after a Knock Out when an ability allows it', () => {
    const s = scenario({ filler: FIRE.id, stadium: 'Fest', p0: { active: 'Twice' }, p1: { active: 'D', bench: ['D', 'D'] } })
    const mid = run(s, { type: 'attack', attack: 'Splash' })
    expect(mid.pendingPrompt?.kind).toBe('choosePokemon')
    const promoted = mid.pendingPrompt!.kind === 'choosePokemon' ? (mid.pendingPrompt as { options: number[] }).options[0] : 0
    const again = run(s, { type: 'attack', attack: 'Splash' }, [[promoted]])
    expect(again.pendingPrompt?.kind).toBe('chooseOption')
    const done = run(s, { type: 'attack', attack: 'Splash' }, [[promoted], [1]])
    expect(done.players[0].prizes).toHaveLength(4)
    expect(done.turnPlayer).toBe(1)
  })
})

describe('stadium actions and events', () => {
  it('runs once per turn and can end the turn', () => {
    let s = scenario({ filler: FIRE.id, stadium: 'Lumi', p0: { active: 'A', deck: ['D', FIRE.id, FIRE.id] }, p1: { active: 'D' } })
    expect(has(s, { type: 'stadiumAction' })).toBe(true)
    s = run(s, { type: 'stadiumAction' }, [[s.players[0].deck[0]]])
    expect(s.players[0].bench).toHaveLength(1)
    expect(s.turnPlayer).toBe(1)
  })

  it('heal respects the Pokémon\'s damage', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', damage: 20 } }, p1: { active: 'D' } })
    const x = { ...ctxOf(s), me: 0 as const, opp: 1 as const, self: null, card: null, effect: 'trainer' as const }
    expect(heal(x, s.players[0].active!, 50)).toBe(20)
  })
})
