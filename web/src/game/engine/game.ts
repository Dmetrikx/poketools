import { actionKey, perform } from './actions'
import { checkAnswer } from './prompt'
import type { Action, Answer, Ctx, Db, GameState, PlayerId, PlayerState, Prompt } from './types'


/**
 * One player input and the answers to every prompt it raised. A game is a
 * seed, two decks and a list of steps; its state is always the replay.
 */
export interface Step {
  action: Action
  answers: Answer[]
}

export interface GameRecord {
  seed: number
  /** Catalog ids, one per physical card. Player 0 plays decks[0]. */
  decks: [string[], string[]]
  steps: Step[]
}

function emptyPlayer(): PlayerState {
  return {
    deck: [], hand: [], discard: [], prizes: [], active: null, bench: [], mulligans: 0,
    flags: { energyAttached: false, supporterPlayed: false, retreated: false, stadiumPlayed: false },
  }
}

/** The state before setup: decks in list order, uids 0..n-1 for player 0, then player 1. */
export function initialState(record: Pick<GameRecord, 'seed' | 'decks'>): GameState {
  const s: GameState = {
    cards: [], players: [emptyPlayer(), emptyPlayer()], stadium: null,
    turn: 0, turnPlayer: 0, firstPlayer: 0, phase: 'setup', winner: null,
    rng: record.seed >>> 0, pendingPrompt: null, log: [],
    markers: [], nextMarkerId: 1, history: [], resolving: [], usedOnce: [],
  }
  for (const p of [0, 1] as PlayerId[]) {
    for (const cardId of record.decks[p]) {
      const uid = s.cards.length
      s.cards.push({ owner: p, cardId })
      s.players[p].deck.push(uid)
    }
  }
  return s
}

/**
 * Runs one step from the state before it. Each prompt the action raises
 * takes the next recorded answer; when they run out, the state is returned
 * mid-step with `pendingPrompt` set. Answering re-runs the step from the
 * same starting state with one more answer, so procedures never need to be
 * suspended or serialized.
 */
export function runStep(db: Db, before: GameState, step: Step): GameState {
  if (before.pendingPrompt) throw new Error('runStep needs a state between steps')
  const ctx: Ctx = { s: structuredClone(before), db }
  const proc = perform(ctx, step.action)
  let i = 0
  let r = proc.next()
  while (!r.done) {
    const prompt = r.value
    if (i >= step.answers.length) {
      ctx.s.pendingPrompt = prompt
      return ctx.s
    }
    const err = checkAnswer(prompt, step.answers[i])
    if (err) throw new Error(`answer ${i} to "${prompt.title}": ${err}`)
    r = proc.next(step.answers[i++])
  }
  if (i < step.answers.length) throw new Error('more answers than prompts')
  return ctx.s
}

export function replay(db: Db, record: GameRecord): GameState {
  let s = initialState(record)
  for (const step of record.steps) s = runStep(db, s, step)
  return s
}

export type Input = { action: Action } | { answer: Answer }

/**
 * A game in progress: the record plus a cache of the state after each
 * step. Inputs that break the rules throw and leave the game unchanged.
 */
export class Game {
  readonly db: Db
  readonly record: GameRecord
  /** states[i] is the state after steps[0..i-1]; states[0] is before setup. */
  private states: GameState[]

  constructor(db: Db, record: Omit<GameRecord, 'steps'> & { steps?: Step[] }) {
    this.db = db
    this.record = { seed: record.seed, decks: record.decks, steps: [] }
    this.states = [initialState(record)]
    for (const step of record.steps ?? []) this.push(step)
    if (!this.record.steps.length) this.dispatch({ action: { type: 'start' } })
  }

  get state(): GameState {
    return this.states[this.states.length - 1]
  }

  get prompt(): Prompt | null {
    return this.state.pendingPrompt
  }

  dispatch(input: Input): GameState {
    if ('answer' in input) {
      const steps = this.record.steps
      if (!this.prompt || !steps.length) throw new Error('nothing to answer')
      const last = steps[steps.length - 1]
      const step: Step = { action: last.action, answers: [...last.answers, input.answer] }
      const next = runStep(this.db, this.states[this.states.length - 2], step)
      steps[steps.length - 1] = step
      this.states[this.states.length - 1] = next
      return next
    }
    if (this.prompt) throw new Error('answer the pending prompt first')
    if (input.action.type === 'start' && this.record.steps.length) throw new Error('already started')
    this.push({ action: input.action, answers: [] })
    return this.state
  }

  private push(step: Step): void {
    const next = runStep(this.db, this.state, step)
    this.record.steps.push(step)
    this.states.push(next)
  }

  /** Takes back the last answer, or the last action if it had none. Setup's start is never removed. */
  undo(): boolean {
    const steps = this.record.steps
    const last = steps[steps.length - 1]
    if (!last) return false
    if (last.answers.length) {
      const step: Step = { action: last.action, answers: last.answers.slice(0, -1) }
      steps[steps.length - 1] = step
      this.states[this.states.length - 1] = runStep(this.db, this.states[this.states.length - 2], step)
      return true
    }
    if (steps.length === 1) return false
    steps.pop()
    this.states.pop()
    return true
  }

  /** The same key `legalActions` uses, so the UI can match an action it built. */
  static key = actionKey
}
