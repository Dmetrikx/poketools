import type { CSSProperties } from 'react'
import type { PlayerId } from '@/game/engine/types'
import { markClasses, useBoard } from './board'
import Card from './Card'
import { useView } from './view'
import marks from './marks.module.css'
import styles from './Hand.module.css'

interface Props {
  player: PlayerId
  /** The viewer's hand, along the bottom edge; otherwise along the top. */
  near: boolean
  faceUp: boolean
}

/** A hand as an overlapping row; the overlap grows so any hand fits. */
export default function Hand({ player, near, faceUp }: Props) {
  const v = useView()
  const board = useBoard()
  const hand = v.state.players[player].hand
  return (
    <div
      className={`${styles.hand} ${near ? styles.near : styles.far} ${faceUp ? styles.up : ''}`}
      style={{ '--n': hand.length } as CSSProperties}
      data-zone={`p${player}-hand`}
      aria-label={`${v.names[player]}'s hand, ${hand.length} cards`}
    >
      {hand.map((uid, i) => {
        const hit = near ? board.hand(uid) : {}
        const click = hit.onClick
        return (
          <div
            key={uid}
            className={`${styles.slot} ${markClasses(hit, marks)} ${hit.selected || hit.picked ? styles.lifted : ''} ${click ? styles.clickable : ''}`}
            style={{ '--i': i } as CSSProperties}
            onClick={click ? e => { e.stopPropagation(); click(e.currentTarget) } : undefined}
            onKeyDown={click ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(e.currentTarget) } } : undefined}
            onPointerDown={hit.onPointerDown}
            role={click ? 'button' : undefined}
            tabIndex={click ? 0 : undefined}
            aria-label={faceUp ? v.card(uid).name : 'Face-down card'}
            aria-pressed={click && (hit.selected || hit.picked) ? true : undefined}
          >
            <Card uid={uid} faceUp={faceUp} />
            {hit.picked && <span className={styles.check} aria-hidden>✓</span>}
            {hit.badge && <span className={styles.badge}>{hit.badge}</span>}
          </div>
        )
      })}
      {!near && <span className={styles.count} title={`${hand.length} cards in hand`}>{hand.length}</span>}
      {near && hand.length === 0 && <span className={styles.empty}>No cards in hand</span>}
    </div>
  )
}
