// Helpers for card scenario tests against the real catalog and registry.

import { actionKey, legalActions } from '../engine/actions'
import { runStep } from '../engine/game'
import { catalogDb, scenario, type ScenarioSpec } from '../engine/testing'
import type { Action, Answer, GameState, PlayerId, Prompt } from '../engine/types'
import './index'

export const E = {
  G: 'MEE-9', R: 'MEE-10', W: 'MEE-11', L: 'MEE-12', P: 'MEE-13', F: 'MEE-14', D: 'MEE-15', M: 'MEE-16',
} as const

export const db = catalogDb

export function setup(spec: Omit<ScenarioSpec, 'filler'> & { filler?: string }): GameState {
  return scenario({ filler: E.P, ...spec })
}

export type Picker = (p: Prompt, s: GameState) => Answer | undefined

/** Default answers: take as many options as allowed, the first option, yes. */
export const greedy: Picker = p => {
  switch (p.kind) {
    case 'chooseCards':
    case 'choosePokemon': return p.options.slice(0, Math.max(Math.min(p.max, p.options.length), Math.min(p.min, p.options.length)))
    case 'chooseOption': return [0]
    case 'yesNo': return [1]
    case 'order': return [...p.cards]
    case 'distribute': return p.options.map((_, i) => (i === 0 ? p.total : 0))
  }
}

/** Given answers first (undefined entries fall back to greedy), then greedy. */
export function answers(...given: (Answer | undefined)[]): Picker {
  let i = 0
  return (p, s) => given[i++] ?? greedy(p, s)
}

/** Runs an action to completion, answering every prompt with the picker. */
export function drive(s: GameState, action: Action, pick: Picker = greedy): GameState {
  const given: Answer[] = []
  for (let i = 0; i < 50; i++) {
    const next = runStep(db, s, { action, answers: given })
    if (!next.pendingPrompt) return next
    given.push(pick(next.pendingPrompt, next) ?? greedy(next.pendingPrompt, next)!)
  }
  throw new Error('too many prompts')
}

export function uid(s: GameState, p: PlayerId, zone: 'hand' | 'deck' | 'discard' | 'prizes', cardId: string): number {
  const found = s.players[p][zone].find(u => s.cards[u].cardId === cardId)
  if (found === undefined) throw new Error(`${cardId} not in ${zone}`)
  return found
}

export function ids(s: GameState, uids: number[]): string[] {
  return uids.map(u => s.cards[u].cardId)
}

/** Plays a trainer from the turn player's hand. */
export function play(s: GameState, cardId: string, pick: Picker = greedy, target?: number): GameState {
  const card = uid(s, s.turnPlayer, 'hand', cardId)
  return drive(s, target === undefined ? { type: 'playTrainer', card } : { type: 'playTrainer', card, target }, pick)
}

export function can(s: GameState, a: Action): boolean {
  return legalActions({ s, db }).some(x => actionKey(x) === actionKey(a))
}

export function canPlay(s: GameState, cardId: string): boolean {
  const card = uid(s, s.turnPlayer, 'hand', cardId)
  return legalActions({ s, db }).some(x => x.type === 'playTrainer' && x.card === card)
}
