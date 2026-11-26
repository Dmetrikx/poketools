import { describe, expect, it } from 'vitest'
import { actionKey, legalActions } from '../engine/actions'
import { runStep } from '../engine/game'
import type { CardImpl, MarkerImpl } from '../engine/impl'
import { attack, dbFrom, energy, implsFrom, pokemon, scenario, trainer } from '../engine/testing'
import type { Action, Answer, GameState } from '../engine/types'
import { addMarker, applyCondition, discardAttached, sel } from './index'

const FIRE = energy('Fire')
const cards = [
  FIRE,
  pokemon('A', { name: 'Attacker', hp: 100, types: ['Fire'], attacks: [attack('Poison', [], 10, 'poison'), attack('Lock Items', [], 10, 'items')] }),
  pokemon('D', { name: 'Defender', hp: 100, types: ['Water'], attacks: [attack('Tap', [], 10)] }),
  pokemon('Eevee', { name: 'Eevee ex', hp: 200, types: ['Colorless'], tags: ['ex'], abilities: [{ name: 'DNA', text: '' }], attacks: [] }),
  pokemon('Jolt', { name: 'Jolt ex', subtype: 'Stage 1', evolveFrom: 'Eevee', hp: 280, types: ['Lightning'], tags: ['ex'], attacks: [] }),
  pokemon('Toxic', { name: 'Toxic', hp: 100, types: ['Darkness'], abilities: [{ name: 'More Poison', text: '' }], attacks: [] }),
  pokemon('Mon', { name: 'Mon', hp: 60, types: ['Colorless'], attacks: [] }),
  trainer('Item', 'Item'), trainer('Mist', 'Tool'), trainer('Fest', 'Stadium'), trainer('Zone', 'Stadium'), trainer('Igni', 'Tool'),
]

const impls: Record<string, CardImpl> = {
  A: {
    attacks: {
      *Poison(a) { if (a.defender) applyCondition(a, a.defender, 'poisoned') },
      *'Lock Items'(a) { addMarker(a, 'itemLock', { until: 'opponentsNextTurn' }) },
    },
  },
  Item: { trainer: { *play() {} } },
  Mist: { trainer: { modifiers: { preventEffect: (src, _c, r) => r.target.id === src.slot?.id && r.from === 'attack' && r.by !== src.player } } },
  Fest: { trainer: { modifiers: { canHaveCondition: (_s, _ctx, slot) => slot.energy.length === 0 } } },
  Zone: {
    trainer: {
      modifiers: { benchSize: (_s, ctx, p) => (sel.inPlayOf(ctx, p, sel.tera).length ? 8 : undefined) },
    },
  },
  Eevee: { abilities: { DNA: { modifiers: { evolvesFrom: (src, ctx, slot, uid) => src.slot?.id === slot.id && sel.ex(ctx.db.card(ctx.s.cards[uid].cardId)) && ctx.db.card(ctx.s.cards[uid].cardId).evolveFrom === 'Eevee' } } } },
  Toxic: { abilities: { 'More Poison': { modifiers: { poisonCounters: (src, ctx, slot) => (ctx.s.cards[slot.id].owner !== src.player ? 5 : 0) } } } },
  Igni: { trainer: { on: { *turnEnd(x, ev) { if (ev.player === x.me && x.self) yield* discardAttached(x, [x.card!]) } } } },
}
const markers: Record<string, MarkerImpl> = {
  itemLock: { modifiers: { canPlay: (src, ctx, p, uid) => !(p !== src.player && ctx.db.card(ctx.s.cards[uid].cardId).subtype === 'Item') } },
}

const db = dbFrom(cards as never, implsFrom(impls, markers))
const run = (s: GameState, action: Action, answers: Answer[] = []) => runStep(db, s, { action, answers })
const has = (s: GameState, a: Action) => legalActions({ s, db }).some(x => actionKey(x) === actionKey(a))

describe('modifier hooks', () => {
  it('a Tool can prevent effects of the opponent\'s attacks', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'A' }, p1: { active: { card: 'D', tools: ['Mist'] } } })
    expect(run(s, { type: 'attack', attack: 'Poison' }).players[1].active!.poisoned).toBe(false)
  })

  it('an attack can stop the opponent playing Items during their next turn only', () => {
    let s = scenario({ filler: FIRE.id, p0: { active: 'A' }, p1: { active: 'D', hand: ['Item'] } })
    s = run(s, { type: 'attack', attack: 'Lock Items' })
    const item = s.players[1].hand.find(u => s.cards[u].cardId === 'Item')!
    expect(has(s, { type: 'playTrainer', card: item })).toBe(false)
    s = run(s, { type: 'endTurn' })
    s = run(s, { type: 'endTurn' })
    expect(has(s, { type: 'playTrainer', card: item })).toBe(true)
  })

  it('an ability can let a Pokémon evolve into a card with another name', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Eevee', hand: ['Jolt'] }, p1: { active: 'D' } })
    expect(has(s, { type: 'evolve', card: s.players[0].hand[0], target: s.players[0].active!.id })).toBe(true)
  })

  it('an ability adds Poison damage counters during Checkup', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: 'Toxic' }, p1: { active: { card: 'D', poisoned: true } } })
    expect(run(s, { type: 'endTurn' }).players[1].active!.damage).toBe(60)
  })

  it('a Stadium can remove and block Special Conditions', () => {
    const s2 = scenario({ filler: FIRE.id, stadium: 'Fest', p0: { active: 'D', hand: [FIRE.id] }, p1: { active: 'A' } })
    s2.players[0].active!.rotation = 'asleep'
    const att = run(s2, { type: 'attachEnergy', card: s2.players[0].hand[0], target: s2.players[0].active!.id })
    expect(att.players[0].active!.rotation).toBeNull()
  })

  it('a Bench over the limit is cut down by its owner', () => {
    const s = scenario({ filler: FIRE.id, stadium: 'Zone', p0: { active: 'A', bench: ['Mon', 'Mon', 'Mon', 'Mon', 'Mon', 'Mon'] }, p1: { active: 'D' } })
    const after = run(s, { type: 'judge', judge: { op: 'setDamage', slot: s.players[1].active!.id, damage: 0 } })
    expect(after.pendingPrompt?.kind).toBe('choosePokemon')
    const pick = after.players[0].bench[0].id
    const done = run(s, { type: 'judge', judge: { op: 'setDamage', slot: s.players[1].active!.id, damage: 0 } }, [[pick]])
    expect(done.players[0].bench).toHaveLength(5)
  })

  it('a Tool can act at the end of its owner\'s turn', () => {
    const s = scenario({ filler: FIRE.id, p0: { active: { card: 'A', tools: ['Igni'] } }, p1: { active: 'D' } })
    const after = run(s, { type: 'endTurn' })
    expect(after.players[0].active!.tools).toHaveLength(0)
    expect(after.players[0].discard).toHaveLength(1)
  })
})
