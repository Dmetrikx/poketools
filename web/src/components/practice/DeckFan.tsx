import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
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
 * It opens scrolled fully right, with the bottom card at the center, so
 * thumbing through means scrolling left toward the top. Whichever card sits
 * at the center lifts out of the fan; clicking it marks it as seen, and
 * clicking any other card scrolls that one to the center.
 */
export default function DeckFan({ cards, imageMap, marked, onToggleMark, onClearMarks }: Props) {
  const [sorted, setSorted] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  // The toolbar shows how to thumb through until the fan first moves.
  const [moved, setMoved] = useState(false)
  const startCard = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef({ pressed: false, dragging: false, startX: 0, startScroll: 0 })
  // Card an arrow key is scrolling to, so repeated presses don't wait for the scroll.
  const keyTarget = useRef<number | null>(null)
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

  // The card whose center is nearest the strip's center. Slot offsets are
  // layout positions (the strip is their offsetParent), so the lifted card's
  // transform doesn't skew them.
  const centerCard = () => {
    const strip = stripRef.current
    if (!strip) return null
    const mid = strip.scrollLeft + strip.clientWidth / 2
    let best: number | null = null
    let bestDist = Infinity
    cardRefs.current.forEach((el, i) => {
      if (!el || i >= ordered.length) return
      const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid)
      if (dist < bestDist) { best = i; bestDist = dist }
    })
    return best
  }

  // Pick the deck up at its bottom card, before the first paint so it doesn't jump.
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (strip) strip.scrollLeft = strip.scrollWidth - strip.clientWidth
    startCard.current = centerCard()
    setActive(startCard.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScroll = () => {
    cancelAnimationFrame(scrollFrame.current)
    scrollFrame.current = requestAnimationFrame(() => {
      const center = centerCard()
      setActive(center)
      if (center !== startCard.current) setMoved(true)
      if (center === keyTarget.current) keyTarget.current = null
    })
  }

  const scrollToCard = (index: number) => {
    const clamped = Math.max(0, Math.min(ordered.length - 1, index))
    keyTarget.current = clamped
    cardRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollToCard((keyTarget.current ?? active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      scrollToCard(e.key === 'Home' ? 0 : ordered.length - 1)
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

  const handleCardClick = (index: number) => {
    if (drag.current.dragging) return
    if (index === active) onToggleMark(ordered[index].uid)
    else scrollToCard(index)
  }

  const activeCard = active !== null ? ordered[active] : undefined

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.counter}>
          {activeCard && moved ? (
            <>
              <strong>Card {active! + 1}</strong> / {ordered.length}
              <span className={styles.activeName}>{activeCard.entry.name}</span>
            </>
          ) : (
            <span>
              {ordered.length} cards ·{' '}
              <span className={styles.pointerHint}>scroll, swipe or use ← → to thumb through</span>
              <span className={styles.touchHint}>swipe to thumb through</span>
            </span>
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
              >
                <PlayingCard
                  entry={card.entry}
                  image={imageMap.get(imageKey(card.entry))}
                  faceUp
                  onClick={() => handleCardClick(i)}
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
