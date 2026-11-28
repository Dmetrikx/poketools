import { describe, expect, it } from 'vitest'
import { setup } from '@/game/cards/testkit'
import type { Prompt } from '@/game/engine/types'
import { answersOnClick, canAdd, countLine, placement, toggle } from './promptPicks'

const GOLDEEN = 'PBL-13'

describe('placement', () => {
  const s = setup({ p0: { active: GOLDEEN, hand: [GOLDEEN, GOLDEEN] }, p1: { active: GOLDEEN } })
  const [h0, h1] = s.players[0].hand
  const deckCard = s.players[0].deck[0]

  it('answers hand picks in the hand, face up only', () => {
    expect(placement({ kind: 'chooseCards', player: 0, title: '', options: [h0, h1], min: 1, max: 1 }, s)).toBe('hand')
    expect(placement({ kind: 'chooseCards', player: 0, title: '', options: [h0, h1], min: 1, max: 1, hidden: true }, s)).toBe('tray')
    expect(placement({ kind: 'chooseCards', player: 0, title: '', options: [h0, deckCard], min: 1, max: 1 }, s)).toBe('tray')
    // Not the asked player's hand.
    expect(placement({ kind: 'chooseCards', player: 1, title: '', options: [h0], min: 1, max: 1 }, s)).toBe('tray')
  })

  it('puts Pokémon prompts on the board and the rest in dialogs', () => {
    expect(placement({ kind: 'choosePokemon', player: 0, title: '', options: [1], min: 1, max: 1 }, s)).toBe('board')
    expect(placement({ kind: 'distribute', player: 0, title: '', options: [1, 2], total: 3 }, s)).toBe('board')
    expect(placement({ kind: 'order', player: 0, title: '', cards: [1, 2] }, s)).toBe('tray')
    expect(placement({ kind: 'yesNo', player: 0, title: '' }, s)).toBe('dialog')
    expect(placement({ kind: 'chooseOption', player: 0, title: '', options: ['a', 'b'] }, s)).toBe('dialog')
  })
})

describe('picking', () => {
  it('toggles, replaces a single pick, and stops at the limit', () => {
    expect(toggle([], 3, 2)).toEqual([3])
    expect(toggle([3], 3, 2)).toEqual([])
    expect(toggle([3], 4, 1)).toEqual([4])
    expect(toggle([3, 4], 5, 2)).toEqual([3, 4])
  })

  it('answers a single required pick on click', () => {
    expect(answersOnClick({ kind: 'choosePokemon', player: 0, title: '', options: [1, 2], min: 1, max: 1 })).toBe(true)
    expect(answersOnClick({ kind: 'choosePokemon', player: 0, title: '', options: [1, 2], min: 0, max: 1 })).toBe(false)
  })

  it('describes the count', () => {
    const p: Prompt = { kind: 'chooseCards', player: 0, title: '', options: [1, 2, 3], min: 1, max: 2 }
    expect(countLine(p, 1)).toBe('Choose 1–2 · 1 chosen')
    expect(countLine({ kind: 'distribute', player: 0, title: '', options: [1, 2], total: 4 }, 3)).toBe('1 of 4 left to place')
  })

  it('respects maxEach', () => {
    const p: Extract<Prompt, { kind: 'distribute' }> = { kind: 'distribute', player: 0, title: '', options: [1, 2], total: 4, maxEach: [1, 4] }
    expect(canAdd(p, [1, 0], 0)).toBe(false)
    expect(canAdd(p, [1, 0], 1)).toBe(true)
    expect(canAdd(p, [1, 3], 1)).toBe(false)
  })
})
