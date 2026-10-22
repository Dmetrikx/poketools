import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cardImageUrl } from '@/hooks/useCardImages'
import styles from './CardPreview.module.css'

// Wide enough for rules text to be readable (~10px), at the card's 600:825.
const WIDTH = 300
const HEIGHT = Math.round(WIDTH * 825 / 600)
const GAP = 12
const MARGIN = 8
const DELAY_MS = 300

// Touch screens have no hover; tapping a card already opens it full size.
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

interface Shown {
  url: string
  left: number
  top: number
}

/** Beside the card if it fits, else on its other side; clamped to the viewport. */
function place(rect: DOMRect): { left: number; top: number } {
  let left = rect.right + GAP
  if (left + WIDTH > window.innerWidth - MARGIN) left = rect.left - GAP - WIDTH
  left = Math.max(MARGIN, left)
  const centered = rect.top + rect.height / 2 - HEIGHT / 2
  const top = Math.min(Math.max(MARGIN, centered), window.innerHeight - HEIGHT - MARGIN)
  return { left, top: Math.max(MARGIN, top) }
}

/**
 * Hover-to-enlarge for small cards: `bind(image)` goes on the card element,
 * and `preview` must be rendered by the caller. Cards keep their size; the
 * preview floats above everything (including modals) and ignores the pointer.
 */
export function useCardPreview() {
  const [shown, setShown] = useState<Shown | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setShown(null)
  }, [])

  // The card may move away under a stationary preview, so scrolling hides it.
  useEffect(() => {
    if (!shown) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [shown, hide])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const bind = (image: string | undefined) => {
    if (!image || !canHover()) return {}
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        const el = e.currentTarget
        window.clearTimeout(timer.current)
        // Measured after the delay, once any hover lift has settled.
        timer.current = window.setTimeout(() => {
          setShown({ url: cardImageUrl(image), ...place(el.getBoundingClientRect()) })
        }, DELAY_MS)
      },
      onMouseLeave: hide,
      onMouseDown: hide,
    }
  }

  const preview = shown && createPortal(
    <img
      className={styles.preview}
      src={shown.url}
      alt=""
      aria-hidden="true"
      style={{ left: shown.left, top: shown.top, width: WIDTH, height: HEIGHT }}
    />,
    document.body,
  )

  return { bind, preview }
}
