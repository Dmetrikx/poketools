import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react'
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
const DRAG_THRESHOLD = 6
// Resistance: how far the fan moves per pixel of drag or wheel.
const DRAG_RATIO = 0.75
const WHEEL_RATIO = 0.6
// A fling's speed (scroll px/ms) grows with the square of the release speed
// (pointer px/ms), so a gentle flick moves a card or two and only a hard one
// runs through the deck. Capped at MAX_FLING.
const FLING_GAIN = 0.3
const MAX_FLING = 8
// A fling glides as far as it would coasting with this share of its speed
// kept per 16ms frame, then lands on the card nearest that point.
const FRICTION = 0.95
const GLIDE = 16 / (1 - FRICTION)
// Bounds on a fling's length (ms), and the length of short moves: settling
// after a drag, arrow keys, clicks and wheel steps.
const MIN_GLIDE_TIME = 200
const MAX_GLIDE_TIME = 1400
const GLIDE_TIME_PER_PX = 0.6
const SNAP_TIME = 240
const WHEEL_TIME = 180
// Pointer samples older than this don't count toward a fling's speed.
const VELOCITY_WINDOW = 100
// Wheel quiet time after which the next wheel event starts from the fan's
// position rather than adding to the previous ones.
const WHEEL_IDLE = 200

interface Sample { t: number; x: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

interface SlotProps {
  card: DealtCard
  index: number
  image: string | undefined
  marked: boolean
  active: boolean
  onClick: (index: number) => void
  setRef: (index: number, el: HTMLDivElement | null) => void
}

// Memoized so moving the center only re-renders the two cards whose `active` flips.
const FanSlot = memo(function FanSlot({ card, index, image, marked, active, onClick, setRef }: SlotProps) {
  return (
    <div
      ref={el => setRef(index, el)}
      data-index={index}
      className={`${styles.slot} ${active ? styles.active : ''} ${marked ? styles.marked : ''}`}
    >
      <PlayingCard
        entry={card.entry}
        image={image}
        faceUp
        onClick={() => onClick(index)}
        className={styles.fanCard}
      />
      {marked && <span className={styles.check}>✓</span>}
    </div>
  )
})

/**
 * The remaining deck spread face up in an overlapping fan that scrolls
 * sideways, top of the deck on the left and the bottom card at the far right.
 * It opens scrolled fully right, with the bottom card at the center, so
 * thumbing through means scrolling left toward the top. Drags, swipes and the
 * wheel are damped and flings take effort (see DRAG_RATIO, FLING_GAIN); every
 * move is one eased animation that lands with a card at the center, rather
 * than native scrolling that flings past half the deck. The card at the
 * center lifts out of the fan, eased in and out with the scroll position
 * (see paint); clicking it marks it as seen, and clicking any other card
 * scrolls that one to the center.
 */
export default function DeckFan({ cards, imageMap, marked, onToggleMark, onClearMarks }: Props) {
  const [sorted, setSorted] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  // The toolbar shows how to thumb through until the fan first moves.
  const [moved, setMoved] = useState(false)
  const startCard = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef({ pressed: false, dragging: false, startX: 0, startScroll: 0, samples: [] as Sample[] })
  // The running animation, and the card it lands on (so repeated arrow keys
  // and wheel steps build on it instead of waiting for it).
  const anim = useRef<{ frame: number; card: number } | null>(null)
  const wheel = useRef({ pos: 0, last: -Infinity })
  // Last --lift/--part/z-index written to each slot, to skip unchanged writes.
  const painted = useRef(new WeakMap<HTMLElement, string>())

  const ordered = useMemo(() => (sorted ? sortCards(cards) : cards), [cards, sorted])
  const count = ordered.length

  // Layout measurements. Slots are evenly spaced, and their offsets are
  // layout positions (the strip is their offsetParent), so transforms don't
  // skew them. offsetLeft is rounded to whole pixels, so the spacing is
  // measured across the whole fan rather than between two neighbors.
  const metrics = () => {
    const strip = stripRef.current
    const first = cardRefs.current[0]
    if (!strip || !first) return null
    const last = cardRefs.current[count - 1]
    return {
      strip,
      firstCenter: first.offsetLeft + first.offsetWidth / 2,
      step: last && count > 1 ? (last.offsetLeft - first.offsetLeft) / (count - 1) : 1,
      half: strip.clientWidth / 2,
      max: strip.scrollWidth - strip.clientWidth,
    }
  }
  type Metrics = NonNullable<ReturnType<typeof metrics>>

  // The scroll position that centers card `i`, and the card nearest the center at `pos`.
  const cardPos = (m: Metrics, i: number) => clamp(m.firstCenter + i * m.step - m.half, 0, m.max)
  const cardAt = (m: Metrics, pos: number) => clamp(Math.round((pos + m.half - m.firstCenter) / m.step), 0, count - 1)

  // Lift and part each card by its exact distance from the center, so the
  // fan moves in step with the scroll instead of jumping card to card.
  const paint = () => {
    const m = metrics()
    if (!m) return
    const center = (m.strip.scrollLeft + m.half - m.firstCenter) / m.step
    const nearest = clamp(Math.round(center), 0, count - 1)
    cardRefs.current.forEach((el, i) => {
      if (!el || i >= count) return
      const offset = i - center
      const lift = Math.max(0, 1 - Math.abs(offset)).toFixed(3)
      const part = clamp(offset, 0, 1).toFixed(3)
      const z = i === nearest ? count + 1 : i
      const key = `${lift}|${part}|${z}`
      if (painted.current.get(el) === key) return
      painted.current.set(el, key)
      el.style.setProperty('--lift', lift)
      el.style.setProperty('--part', part)
      el.style.zIndex = String(z)
    })
    setActive(nearest)
    if (nearest !== startCard.current) setMoved(true)
  }

  const stopMotion = () => {
    if (anim.current) cancelAnimationFrame(anim.current.frame)
    anim.current = null
  }

  // Ease to card `index` over `duration` ms.
  const scrollToCard = (index: number, duration = SNAP_TIME) => {
    const m = metrics()
    if (!m) return
    stopMotion()
    const card = clamp(index, 0, count - 1)
    const from = m.strip.scrollLeft
    const to = cardPos(m, card)
    if (Math.abs(to - from) < 0.5) {
      m.strip.scrollLeft = to
      paint()
      return
    }
    const start = performance.now()
    const a = { frame: 0, card }
    const step = (now: number) => {
      const t = clamp((now - start) / duration, 0, 1)
      m.strip.scrollLeft = from + (to - from) * easeOutCubic(t)
      paint()
      if (t < 1) a.frame = requestAnimationFrame(step)
      else if (anim.current === a) anim.current = null
    }
    a.frame = requestAnimationFrame(step)
    anim.current = a
  }

  // Glide at `speed` (scroll px/ms) and land on the card nearest where it
  // would coast to, in one animation that starts at the release speed.
  const fling = (speed: number) => {
    const m = metrics()
    if (!m) return
    const from = m.strip.scrollLeft
    const card = cardAt(m, from + speed * GLIDE)
    const dist = cardPos(m, card) - from
    // easeOutCubic starts at 3× its average speed. A slow release would
    // stretch a short settle into a crawl, so the length is also capped by
    // distance.
    const sameWay = speed !== 0 && Math.sign(dist) === Math.sign(speed)
    const cap = Math.min(MAX_GLIDE_TIME, SNAP_TIME + Math.abs(dist) * GLIDE_TIME_PER_PX)
    const duration = sameWay ? clamp((3 * Math.abs(dist)) / Math.abs(speed), MIN_GLIDE_TIME, cap) : SNAP_TIME
    scrollToCard(card, duration)
  }

  useEffect(() => () => stopMotion(), [])

  // Pick the deck up at its bottom card, before the first paint so it doesn't jump.
  useLayoutEffect(() => {
    const m = metrics()
    if (!m) return
    m.strip.scrollLeft = m.max
    startCard.current = cardAt(m, m.max)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-paint when the order changes (slots move to new indexes) or the layout does.
  useLayoutEffect(paint)
  useEffect(() => {
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  })

  // The wheel (either axis) scrolls the fan sideways, damped, a card at a
  // time. React's onWheel is passive, so preventDefault needs a native
  // listener; it's re-bound each render so it sees the current cards.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const m = metrics()
      if (!m) return
      const w = wheel.current
      if (e.timeStamp - w.last > WHEEL_IDLE) w.pos = m.strip.scrollLeft
      w.last = e.timeStamp
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      // Firefox can report lines instead of pixels.
      w.pos = clamp(w.pos + delta * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1) * WHEEL_RATIO, 0, m.max)
      const card = cardAt(m, w.pos)
      if (anim.current?.card !== card) scrollToCard(card, WHEEL_TIME)
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollToCard((anim.current?.card ?? active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      scrollToCard(e.key === 'Home' ? 0 : count - 1)
    } else if ((e.key === ' ' || e.key === 'Enter') && active !== null) {
      e.preventDefault()
      onToggleMark(ordered[active].uid)
    }
  }

  // Mouse drags and touch swipes both land here: the strip's touch-action
  // leaves horizontal touch movement to us instead of native scrolling.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopMotion()
    drag.current = {
      pressed: true, dragging: false, startX: e.clientX, startScroll: stripRef.current!.scrollLeft,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.pressed) return
    const dx = e.clientX - d.startX
    if (!d.dragging && Math.abs(dx) > DRAG_THRESHOLD) {
      d.dragging = true
      stripRef.current!.setPointerCapture(e.pointerId)
    }
    if (!d.dragging) return
    stripRef.current!.scrollLeft = d.startScroll - dx * DRAG_RATIO
    paint()
    d.samples.push({ t: e.timeStamp, x: e.clientX })
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > VELOCITY_WINDOW) d.samples.shift()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (d.pressed && d.dragging) {
      const first = d.samples[0]
      const dt = e.timeStamp - first.t
      // Glide only if the pointer was still moving when it let go.
      const v = dt > 0 && dt < VELOCITY_WINDOW * 2 ? (e.clientX - first.x) / dt : 0
      fling(-Math.sign(v) * Math.min(MAX_FLING, FLING_GAIN * v * v))
    }
    d.pressed = false
    // `dragging` stays set until the click that follows the drag is swallowed.
    setTimeout(() => { d.dragging = false }, 0)
  }

  const handleCardClick = (index: number) => {
    if (drag.current.dragging) return
    if (index === active) onToggleMark(ordered[index].uid)
    else scrollToCard(index)
  }

  // Stable callbacks keep FanSlot's memo effective.
  const clickRef = useRef(handleCardClick)
  clickRef.current = handleCardClick
  const onSlotClick = useCallback((index: number) => clickRef.current(index), [])
  const setSlotRef = useCallback((index: number, el: HTMLDivElement | null) => { cardRefs.current[index] = el }, [])

  const activeCard = active !== null ? ordered[active] : undefined

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.counter}>
          {activeCard && moved ? (
            <>
              <strong>Card {active! + 1}</strong> / {count}
              <span className={styles.activeName}>{activeCard.entry.name}</span>
            </>
          ) : (
            <span>
              {count} cards ·{' '}
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
          onScroll={paint}
          aria-label="Remaining deck"
        >
          {ordered.map((card, i) => (
            <FanSlot
              key={card.uid}
              card={card}
              index={i}
              image={imageMap.get(imageKey(card.entry))}
              marked={marked.has(card.uid)}
              active={i === active}
              onClick={onSlotClick}
              setRef={setSlotRef}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
