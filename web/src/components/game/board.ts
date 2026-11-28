import { createContext, useContext, type PointerEvent } from 'react'

/** How one card or zone should look and respond right now. */
export interface Marks {
  /** A legal target, or an option of the open prompt. */
  glow?: boolean
  /** Not a target while something else is picked up. */
  dim?: boolean
  /** The selected (or dragged) source. */
  selected?: boolean
  /** Chosen as an answer to the open prompt. */
  picked?: boolean
  /** Under the pointer while dragging. */
  over?: boolean
  /** Order number, or a count, drawn on the card. */
  badge?: string
}

export interface Stepper {
  value: number
  inc?: () => void
  dec?: () => void
}

export interface Hit extends Marks {
  /** The element is passed so popovers can anchor to it. */
  onClick?: (el: HTMLElement) => void
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void
  stepper?: Stepper
}

/** What the table tells each piece of the board; built fresh every render. */
export interface Board {
  slot(id: number): Hit
  hand(uid: number): Hit
  zone(kind: 'bench' | 'stadium'): Hit
}

const none: Hit = {}
export const idleBoard: Board = { slot: () => none, hand: () => none, zone: () => none }

export const BoardContext = createContext<Board>(idleBoard)
export const useBoard = () => useContext(BoardContext)

/** Class names for a set of marks, from a stylesheet that defines them. */
export function markClasses(m: Marks, styles: Record<string, string>): string {
  return [
    m.glow && styles.glow, m.dim && styles.dim, m.selected && styles.selected,
    m.picked && styles.picked, m.over && styles.over,
  ].filter(Boolean).join(' ')
}
