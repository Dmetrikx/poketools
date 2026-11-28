import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Source } from './targets'

/** Pointer travel before a press becomes a drag, so a click stays a click. */
const THRESHOLD = 6

export interface DragState {
  src: Source
  /** The card drawn under the pointer. */
  uid: number
  /** Top-left of the dragged card, in viewport pixels. */
  x: number
  y: number
  w: number
  h: number
  /** The accepted drop zone under the pointer. */
  over: string | null
}

interface Pending {
  src: Source
  uid: number
  id: number
  x0: number
  y0: number
  offX: number
  offY: number
  w: number
  h: number
  active: boolean
  over: string | null
  accepts: Set<string>
  el: HTMLElement
}

/** The first element under the point whose `data-drop` is accepted. */
function zoneAt(x: number, y: number, accepts: Set<string>): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const key = (el as HTMLElement).dataset?.drop
    if (key && accepts.has(key)) return key
  }
  return null
}

/** Swallows the click that follows a drag's pointerup. */
function swallowNextClick() {
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', stop, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
}

interface Options {
  /** Called once the press turns into a drag. */
  onStart: (src: Source) => void
  /** `zone` is null when the card was dropped somewhere that doesn't accept it. */
  onDrop: (src: Source, zone: string | null, x: number, y: number) => void
}

/**
 * Pointer-event drag and drop. `bind(src, uid, accepts)` goes on the
 * element's onPointerDown; zones are elements with a `data-drop` key, found
 * under the pointer with `elementsFromPoint`. Escape cancels.
 */
export function useDrag(opts: Options) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const pending = useRef<Pending | null>(null)
  const latest = useRef(opts)
  latest.current = opts
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanup.current?.(), [])

  const bind = useCallback((src: Source, uid: number, accepts: Set<string>) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !e.isPrimary) return
    cleanup.current?.()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const p: Pending = {
      src, uid, id: e.pointerId, x0: e.clientX, y0: e.clientY,
      offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, h: rect.height,
      active: false, over: null, accepts, el,
    }
    pending.current = p

    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== p.id) return
      if (!p.active) {
        if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) < THRESHOLD) return
        p.active = true
        try { p.el.setPointerCapture(p.id) } catch { /* the element may be gone */ }
        latest.current.onStart(p.src)
      }
      ev.preventDefault()
      p.over = zoneAt(ev.clientX, ev.clientY, p.accepts)
      setDrag({ src: p.src, uid: p.uid, x: ev.clientX - p.offX, y: ev.clientY - p.offY, w: p.w, h: p.h, over: p.over })
    }
    const end = (drop: boolean) => (ev: globalThis.PointerEvent | KeyboardEvent) => {
      if ('pointerId' in ev && ev.pointerId !== p.id) return
      if (!('pointerId' in ev) && ev.key !== 'Escape') return
      stop()
      if (!p.active) return
      swallowNextClick()
      setDrag(null)
      if (drop && 'clientX' in ev) {
        const zone = zoneAt(ev.clientX, ev.clientY, p.accepts)
        latest.current.onDrop(p.src, zone, ev.clientX, ev.clientY)
      }
    }
    const up = end(true)
    const cancel = end(false)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', cancel)
      pending.current = null
      cleanup.current = null
    }
    cleanup.current = () => { stop(); setDrag(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', cancel)
  }, [])

  const cancel = useCallback(() => cleanup.current?.(), [])

  return { drag, bind, cancel }
}
