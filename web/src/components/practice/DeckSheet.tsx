import { useRef, useState, type ReactNode } from 'react'
import styles from './DeckSheet.module.css'

interface Props {
  onClose: () => void
  children: ReactNode
}

// Downward drag on the handle past which letting go puts the deck down.
const CLOSE_DISTANCE = 80

/**
 * Holds the picked-up deck. On wide screens it's a plain block under the
 * board; on phones it's a bottom sheet over most of the screen, put back
 * down with the handle (tap or swipe down) or a tap on the dimmed board above.
 */
export default function DeckSheet({ onClose, children }: Props) {
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const drag = useRef<{ startY: number; moved: boolean } | null>(null)

  const putDown = () => setClosing(true)

  const handlePointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = Math.max(0, e.clientY - d.startY)
    if (dy > 4) d.moved = true
    if (d.moved) setDragY(dy)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setDragY(null)
    // A tap on the handle puts the deck down too.
    if (!d?.moved || e.clientY - d.startY > CLOSE_DISTANCE) putDown()
  }

  return (
    <>
      <div className={`${styles.backdrop} ${closing ? styles.backdropClosing : ''}`} onClick={putDown} />
      <div
        className={`${styles.sheet} ${closing ? styles.closing : ''}`}
        style={dragY !== null ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTransitionEnd={e => { if (closing && e.target === e.currentTarget) onClose() }}
      >
        <button
          className={styles.handle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { drag.current = null; setDragY(null) }}
          // Keyboard activation sends a click without pointer events.
          onClick={e => { if (e.detail === 0) putDown() }}
          aria-label="Put the deck down"
        >
          <span className={styles.grip} />
          <span>Put down</span>
        </button>
        {children}
      </div>
    </>
  )
}
