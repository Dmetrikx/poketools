import type { ReactNode } from 'react'
import styles from './Playmat.module.css'

interface Props {
  /** Which half is taking its turn: its rim lights up. */
  turn: 'near' | 'far' | null
  /** A card being dragged can be played by dropping it anywhere on the mat. */
  playTarget: boolean
  over: boolean
  children: ReactNode
}

/** The table surface: CSS gradients and one inline SVG, no images. */
export default function Playmat({ turn, playTarget, over, children }: Props) {
  return (
    <div className={styles.mat} data-drop="play">
      <div className={styles.decor} aria-hidden>
        <div className={`${styles.half} ${styles.far} ${turn === 'far' ? styles.turn : ''}`} />
        <div className={`${styles.half} ${styles.near} ${turn === 'near' ? styles.turn : ''}`} />
        <div className={styles.ribbon} />
        <svg className={styles.emblem} viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M100 30 L160 65 L160 135 L100 170 L40 135 L40 65 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 100 H192" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {children}
      {playTarget && <div className={`${styles.dropHint} ${over ? styles.dropOver : ''}`}>Drop on the mat to play</div>}
    </div>
  )
}
