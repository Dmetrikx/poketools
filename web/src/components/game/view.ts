import { createContext, useContext } from 'react'
import { imageKey } from '@/hooks/useCardImages'
import { gameDb } from '@/game/db'
import type { CatalogCard } from '@/game/catalog/types'
import type { GameState } from '@/game/engine/types'
import type { CardEntry } from '@/types/deck'

/** How the board turns a uid into something to draw. */
export interface GameView {
  state: GameState
  card(uid: number): CatalogCard
  entry(uid: number): CardEntry
  image(uid: number): string | undefined
  names: [string, string]
}

export function makeView(state: GameState, entries: CardEntry[], imageMap: Map<string, string>, names: [string, string]): GameView {
  return {
    state,
    names,
    card: uid => gameDb.card(state.cards[uid].cardId),
    entry: uid => entries[uid],
    image: uid => {
      const e = entries[uid]
      return e ? e.imageUrl || imageMap.get(imageKey(e)) : undefined
    },
  }
}

export const ViewContext = createContext<GameView | null>(null)

export function useView(): GameView {
  const v = useContext(ViewContext)
  if (!v) throw new Error('useView outside the board')
  return v
}
