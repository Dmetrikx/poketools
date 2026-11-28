import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cardImageUrl } from '@/hooks/useCardImages'
import type { LastChange } from '@/hooks/useGame'
import type { GameState, PlayerId } from '@/game/engine/types'
import { diff, type Change, type Place } from './diff'
import type { GameView } from './view'
import styles from './Motion.module.css'

/** At most this many cards fly per change; the rest just appear. */
const MAX_GHOSTS = 10
const FLIGHT_MS = 300
const STAGGER_MS = 40

export interface News {
  id: number
  turn?: { n: number; player: PlayerId }
  coins?: boolean[]
}

interface Snapshot {
  uids: Map<number, DOMRect>
  zones: Map<string, DOMRect>
  slots: Map<number, DOMRect>
}

const BOARD = '[data-board]'

function snapshot(): Snapshot | null {
  const board = document.querySelector(BOARD)
  if (!board) return null
  const shot: Snapshot = { uids: new Map(), zones: new Map(), slots: new Map() }
  for (const el of board.querySelectorAll<HTMLElement>('[data-uid]')) {
    const uid = Number(el.dataset.uid)
    if (!shot.uids.has(uid)) shot.uids.set(uid, el.getBoundingClientRect())
  }
  for (const el of board.querySelectorAll<HTMLElement>('[data-zone]')) shot.zones.set(el.dataset.zone!, el.getBoundingClientRect())
  for (const el of board.querySelectorAll<HTMLElement>('[data-slot]')) shot.slots.set(Number(el.dataset.slot), el.getBoundingClientRect())
  return shot
}

/** The pile (or Pokémon) that stands in for a card with no element of its own. */
function anchor(p: Place): { zone?: string; slot?: number } {
  if (p.zone === 'stadium' || p.zone === 'resolving') return { zone: p.zone }
  if (p.slot !== undefined) return { slot: p.slot }
  return { zone: `p${p.player}-${p.zone}` }
}

const visible = (r: DOMRect | undefined): r is DOMRect => !!r && r.width > 0 && r.height > 0

function rectOf(shot: Snapshot, uid: number, p: Place): DOMRect | undefined {
  const own = shot.uids.get(uid)
  if (visible(own)) return own
  const a = anchor(p)
  return a.zone !== undefined ? shot.zones.get(a.zone) : shot.slots.get(a.slot!)
}

const faceUpAt = (p: Place, viewer: PlayerId) =>
  p.zone === 'deck' || p.zone === 'prizes' ? false : p.zone === 'hand' ? p.player === viewer : true

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Animates what changed between two states: cards fly between zones,
 * damage floats over Pokémon, an attacker lunges, Knocked Out Pokémon tilt
 * away. Runs only for input (not undo, reload or a new game), never under
 * reduced motion, and card flights are skipped when the sides swap, since
 * every card has moved. Returns the news for the Announcer.
 */
export function useBoardMotion(v: GameView, lastChange: LastChange, version: number): News | null {
  const prev = useRef<{ state: GameState; viewer: PlayerId } | null>(null)
  const shot = useRef<Snapshot | null>(null)
  const running = useRef<(() => void)[]>([])
  const layer = useRef<HTMLDivElement | null>(null)
  const [news, setNews] = useState<News | null>(null)

  useEffect(() => {
    const el = document.createElement('div')
    el.className = styles.layer
    document.body.appendChild(el)
    layer.current = el
    return () => {
      for (const stop of running.current.splice(0)) stop()
      el.remove()
    }
  }, [])

  useLayoutEffect(() => {
    const before = prev.current
    prev.current = { state: v.state, viewer: v.viewer }
    for (const stop of running.current.splice(0)) stop()
    if (!before || before.state === v.state || lastChange !== 'input') return

    const change = diff(before.state, v.state)
    const reduced = reducedMotion()
    if (change.coins.length || (change.turnStarted && !reduced)) {
      setNews({
        id: version,
        turn: change.turnStarted ? { n: v.state.turn, player: v.state.turnPlayer } : undefined,
        coins: change.coins.length ? change.coins : undefined,
      })
    }
    if (reduced || !layer.current) return
    const flipped = before.viewer !== v.viewer
    if (!flipped && shot.current) running.current.push(...fly(change, shot.current, v, layer.current))
    running.current.push(...effects(change, layer.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.state])

  // After every commit: where everything is now, for the next change.
  useLayoutEffect(() => { shot.current = snapshot() })

  return news
}

/** Ghost cards from where each card was to where it is. Returns cleanups. */
function fly(change: Change, before: Snapshot, v: GameView, layer: HTMLElement): (() => void)[] {
  const board = document.querySelector(BOARD)
  if (!board) return []
  const now = snapshot()
  if (!now) return []
  const ko = new Set(change.knockedOut)
  const stops: (() => void)[] = []
  let n = 0
  for (const { uid, from, to } of change.moves) {
    if (n >= MAX_GHOSTS) break
    const a = rectOf(before, uid, from)
    const b = rectOf(now, uid, to)
    if (!visible(a) || !visible(b)) continue
    if (Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2) continue

    const ghost = document.createElement('div')
    ghost.className = styles.ghost
    Object.assign(ghost.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })
    const image = v.image(uid)
    if (faceUpAt(from, v.viewer) && faceUpAt(to, v.viewer)) {
      if (image) {
        const img = document.createElement('img')
        img.src = cardImageUrl(image, 'low')
        img.alt = ''
        ghost.appendChild(img)
      } else {
        ghost.classList.add(styles.face)
        ghost.textContent = v.card(uid).name
      }
    } else {
      ghost.classList.add(styles.back)
    }
    layer.appendChild(ghost)

    // The real card waits under its ghost.
    const dest = visible(now.uids.get(uid)) ? board.querySelector<HTMLElement>(`[data-uid="${uid}"]`) : null
    if (dest) dest.style.visibility = 'hidden'

    const dx = a.left - b.left, dy = a.top - b.top
    const sx = a.width / b.width, sy = a.height / b.height
    const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
    const knocked = from.slot !== undefined && ko.has(from.slot)
    const frames: Keyframe[] = knocked
      ? [
          { transform: start, opacity: 1, filter: 'none', offset: 0 },
          { transform: `${start} rotate(14deg)`, opacity: 0.7, filter: 'grayscale(1) brightness(0.7)', offset: 0.4 },
          { transform: 'none', opacity: 1, filter: 'grayscale(1) brightness(0.7)', offset: 1 },
        ]
      : [{ transform: start }, { transform: 'none' }]
    const anim = ghost.animate(frames, {
      duration: knocked ? FLIGHT_MS * 2.2 : FLIGHT_MS,
      delay: n * STAGGER_MS,
      easing: 'cubic-bezier(0.25, 0.7, 0.25, 1)',
      fill: 'backwards',
    })
    const stop = () => {
      anim.cancel()
      ghost.remove()
      if (dest) dest.style.visibility = ''
    }
    anim.onfinish = stop
    stops.push(stop)
    n++
  }
  return stops
}

/** Damage numbers, the attacker's lunge and the defender's shake. Positions are read now. */
function effects(change: Change, layer: HTMLElement): (() => void)[] {
  const board = document.querySelector(BOARD)
  if (!board) return []
  const slotEl = (id: number) => board.querySelector<HTMLElement>(`[data-slot="${id}"]`)
  const stops: (() => void)[] = []
  const hitDelay = change.attacked !== null ? 260 : 0

  if (change.attacked !== null) {
    const el = slotEl(change.attacked)
    const defender = change.damage.find(d => d.delta > 0)
    const target = defender ? slotEl(defender.slot) : null
    if (el) {
      const a = el.getBoundingClientRect()
      const b = target?.getBoundingClientRect()
      const dy = b ? Math.sign(b.top - a.top) * Math.min(40, Math.abs(b.top - a.top) / 3) : -30
      const anim = el.animate(
        [{ transform: 'none' }, { transform: `translateY(${dy}px) scale(1.06)`, offset: 0.4 }, { transform: 'none' }],
        { duration: 420, easing: 'ease-out' },
      )
      stops.push(() => anim.cancel())
    }
    if (target) {
      const anim = target.animate(
        [{ transform: 'none' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }],
        { duration: 380, delay: hitDelay, easing: 'ease-in-out' },
      )
      stops.push(() => anim.cancel())
    }
  }

  for (const { slot, delta } of change.damage) {
    const el = slotEl(slot)
    if (!el) continue
    const r = el.getBoundingClientRect()
    const num = document.createElement('div')
    num.className = `${styles.float} ${delta > 0 ? styles.hurt : styles.heal}`
    num.textContent = delta > 0 ? `−${delta}` : `+${-delta}`
    Object.assign(num.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height * 0.35}px` })
    layer.appendChild(num)
    const anim = num.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -80%) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%, -160%) scale(1)', opacity: 0 },
      ],
      { duration: 1200, delay: hitDelay, easing: 'ease-out', fill: 'backwards' },
    )
    const stop = () => { anim.cancel(); num.remove() }
    anim.onfinish = stop
    stops.push(stop)
  }
  return stops
}
