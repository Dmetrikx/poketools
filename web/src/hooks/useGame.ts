import { useCallback, useMemo, useReducer, useState } from 'react'
import { gameDb } from '@/game/db'
import { legalActions } from '@/game/engine/actions'
import { Game, type GameRecord, type Input } from '@/game/engine/game'
import type { Action } from '@/game/engine/types'

interface Saved {
  signatures: [string, string]
  record: GameRecord
}

function load(key: string, signatures: [string, string]): Game | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    // A game from an older version of either deck is stale.
    if (saved.signatures[0] !== signatures[0] || saved.signatures[1] !== signatures[1]) return null
    return new Game(gameDb, saved.record)
  } catch {
    // Unreadable, or it no longer replays under the current rules.
    return null
  }
}

function save(key: string, signatures: [string, string], game: Game) {
  try {
    localStorage.setItem(key, JSON.stringify({ signatures, record: game.record } satisfies Saved))
  } catch {
    // Storage full or unavailable: the game lasts until the page closes.
  }
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

/**
 * A matchup in progress, saved under `key` after every input and replayed
 * on reload. Inputs that break the rules are refused with an error message.
 */
export function useGame(key: string, signatures: [string, string], decks: [string[], string[]]) {
  const [game, setGame] = useState<Game>(() => load(key, signatures) ?? new Game(gameDb, { seed: newSeed(), decks }))
  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const [error, setError] = useState<string | null>(null)

  const commit = useCallback((g: Game) => {
    save(key, signatures, g)
    setError(null)
    bump()
  }, [key, signatures])

  const dispatch = useCallback((input: Input) => {
    try {
      game.dispatch(input)
      commit(game)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [game, commit])

  const act = useCallback((action: Action) => dispatch({ action }), [dispatch])
  const answer = useCallback((a: number[]) => dispatch({ answer: a }), [dispatch])

  const undo = useCallback(() => {
    if (game.undo()) commit(game)
  }, [game, commit])

  const newGame = useCallback(() => {
    const g = new Game(gameDb, { seed: newSeed(), decks })
    setGame(g)
    commit(g)
  }, [decks, commit])

  const state = game.state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const legal = useMemo(() => legalActions({ s: state, db: gameDb }), [state, version])

  return { state, prompt: state.pendingPrompt, legal, act, answer, undo, newGame, error, canUndo: game.record.steps.length > 1 || (game.record.steps[0]?.answers.length ?? 0) > 0 }
}
