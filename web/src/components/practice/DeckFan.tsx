import { useState, useEffect, useRef, useMemo } from 'react'
import { imageKey } from '@/hooks/useCardImages'
import { sortCards, type DealtCard } from '@/practice/deal'
import PlayingCard from './PlayingCard'
import styles from './DeckFan.module.css'

interface Props {
  cards: DealtCard[]
  imageMap: Map<string, string>
  marked: Set<number>
  onToggleMark: (uid: number) => void
  onClearMarks: () => void
}

// Pointer travel before a press on the strip becomes a drag instead of a click.
const DRAG_THRESHOLD = 5

/**
 * The remaining deck spread face up in an overlapping fan that scrolls
 * sideways, top of the deck on the left and the bottom card at the far right.
 * It opens scrolled fully left, with the top card at the center, so thumbing
 * through means scrolling right. The hovered (or arrow-key focused) card
 * lifts out of the fan; clicking a card marks it as seen.
 */
export default function DeckFan({ cards, imageMap, marked, onToggleMark, onClearMarks }: Props) {
  const [sorted, setSorted] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef({ pressed: false, dragging: false, startX: 0, startScroll: 0 })
  // Last pointer position over the strip; null once it leaves or the keyboard takes over.
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const scrollFrame = useRef(0)

  const ordered = useMemo(() => (sorted ? sortCards(cards) : cards), [cards, sorted])

  // Vertical wheel scrolls the fan sideways. React's onWheel is passive, so
  // preventDefault needs a native listener.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      strip.scrollLeft += e.deltaY
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), [])

  // Browsers don't refresh hover while content scrolls under a still pointer
  // (mouseenter only fires once the mouse moves), so on scroll, lift
  // whichever card is now under the pointer.
  const handleScroll = () => {
    cancelAnimationFrame(scrollFrame.current)
    scrollFrame.current = requestAnimationFrame(() => {
      const p = pointer.current
      if (!p || drag.current.dragging) return
      const slot = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('[data-index]')
      if (slot && stripRef.current?.contains(slot)) setActive(Number(slot.dataset.index))
    })
  }

  const focusCard = (index: number) => {
    // Keyboard navigation scrolls too; don't let the idle pointer steal focus back.
    pointer.current = null
    const clamped = Math.max(0, Math.min(ordered.length - 1, index))
    setActive(clamped)
    cardRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      focusCard((active ?? -1) + (e.key === 'ArrowRight' ? 1 : -1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      focusCard(e.key === 'Home' ? 0 : ordered.length - 1)
    } else if ((e.key === ' ' || e.key === 'Enter') && active !== null) {
      e.preventDefault()
      onToggleMark(ordered[active].uid)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { pressed: true, dragging: false, startX: e.clientX, startScroll: stripRef.current!.scrollLeft }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY }
    const d = drag.current
    if (!d.pressed) return
    const dx = e.clientX - d.startX
    if (!d.dragging && Math.abs(dx) > DRAG_THRESHOLD) {
      d.dragging = true
      stripRef.current!.setPointerCapture(e.pointerId)
    }
    if (d.dragging) stripRef.current!.scrollLeft = d.startScroll - dx
  }

  const handlePointerUp = () => {
    drag.current.pressed = false
    // `dragging` stays set until the click that follows the drag is swallowed.
    setTimeout(() => { drag.current.dragging = false }, 0)
  }

  const handleCardClick = (uid: number) => {
    if (drag.current.dragging) return
    onToggleMark(uid)
  }

  const activeCard = active !== null ? ordered[active] : undefined

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.counter}>
          {activeCard ? (
            <>
              <strong>Card {active! + 1}</strong> / {ordered.length}
              <span className={styles.activeName}>{activeCard.entry.name}</span>
            </>
          ) : (
            <span>{ordered.length} cards · scroll, drag or use ← → to thumb through</span>
          )}
        </div>
        <div className={styles.toolbarActions}>
          <span className={styles.seenCount}>{marked.size} seen</span>
          <button className={styles.toolBtn} onClick={onClearMarks} disabled={marked.size === 0}>
            Clear marks
          </button>
          <div className={styles.toggle}>
            <button
              className={`${styles.toggleBtn} ${!sorted ? styles.toggleActive : ''}`}
              onClick={() => setSorted(false)}
            >Shuffled</button>
            <button
              className={`${styles.toggleBtn} ${sorted ? styles.toggleActive : ''}`}
              onClick={() => setSorted(true)}
            >Sorted</button>
          </div>
        </div>
      </div>

      {/* The viewport holds the focus vignette, which stays put while the strip scrolls */}
      <div className={styles.viewport}>
        <div
          ref={stripRef}
          className={styles.strip}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => { pointer.current = null }}
          onScroll={handleScroll}
          aria-label="Remaining deck"
        >
          {ordered.map((card, i) => {
            const position =
              active === null ? '' :
              i === active ? styles.active :
              i > active ? styles.afterActive : ''
            return (
              <div
                key={card.uid}
                ref={el => { cardRefs.current[i] = el }}
                data-index={i}
                className={`${styles.slot} ${position} ${marked.has(card.uid) ? styles.marked : ''}`}
                style={{ zIndex: i === active ? ordered.length + 1 : i }}
                onMouseEnter={() => { if (!drag.current.dragging) setActive(i) }}
              >
                <PlayingCard
                  entry={card.entry}
                  image={imageMap.get(imageKey(card.entry))}
                  faceUp
                  onClick={() => handleCardClick(card.uid)}
                  className={styles.fanCard}
                />
                {marked.has(card.uid) && <span className={styles.check}>✓</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
