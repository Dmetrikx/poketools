import type { CSSProperties } from 'react'
import type { PlayerId } from '@/game/engine/types'
import { markClasses, useBoard } from './board'
import Card from './Card'
import { useView } from './view'
import marks from './marks.module.css'
import styles from './Zones.module.css'

/** Face-down Prize cards in two overlapping columns, with a count tab. */
export function PrizePile({ player }: { player: PlayerId }) {
  const v = useView()
  const prizes = v.state.players[player].prizes
  return (
    <div className={styles.prizes} data-zone={`p${player}-prizes`} title={`${prizes.length} Prize cards left`}>
      <div className={styles.prizeGrid}>
        {prizes.map((uid, i) => (
          <Card key={uid} uid={uid} faceUp={false} className={styles.prize} style={{ '--row': Math.floor(i / 2), '--col': i % 2 } as CSSProperties} />
        ))}
        {prizes.length === 0 && <div className={`${styles.prize} ${styles.outline}`} style={{ '--row': 0, '--col': 0 } as CSSProperties} />}
      </div>
      <span className={styles.tab}>{prizes.length}<small>Prizes</small></span>
    </div>
  )
}

interface PileProps {
  player: PlayerId
  onOpen: () => void
}

/** The deck: one card back with a count tab. */
export function DeckPile({ player, onOpen }: PileProps) {
  const v = useView()
  const deck = v.state.players[player].deck
  return (
    <button type="button" className={styles.pile} data-zone={`p${player}-deck`} onClick={onOpen} title={`Deck: ${deck.length} cards`}>
      {deck.length > 0
        ? <Card uid={deck[0]} faceUp={false} className={`${styles.pileCard} ${styles.thick}`} />
        : <div className={`${styles.pileCard} ${styles.outline}`} />}
      <span className={styles.tab}>{deck.length}<small>Deck</small></span>
    </button>
  )
}

/** The discard pile: its top card face up, with a count tab. */
export function DiscardPile({ player, onOpen }: PileProps) {
  const v = useView()
  const discard = v.state.players[player].discard
  const top = discard[discard.length - 1]
  return (
    <button type="button" className={styles.pile} data-zone={`p${player}-discard`} onClick={onOpen} title={`Discard pile: ${discard.length} cards`}>
      {top !== undefined
        ? <Card uid={top} className={styles.pileCard} />
        : <div className={`${styles.pileCard} ${styles.outline}`}>Discard</div>}
      <span className={styles.tab}>{discard.length}<small>Discard</small></span>
    </button>
  )
}

/** The Stadium in play, tinted by its owner, or an empty outline. */
export function StadiumSlot() {
  const v = useView()
  const hit = useBoard().zone('stadium')
  const uid = v.state.stadium
  const owner = uid === null ? null : v.state.cards[uid].owner
  const click = hit.onClick
  return (
    <div
      className={`${styles.stadium} ${owner === null ? '' : owner === v.viewer ? styles.mine : styles.theirs} ${markClasses(hit, marks)}`}
      data-drop="stadium"
      data-zone="stadium"
      onClick={click ? e => { e.stopPropagation(); click(e.currentTarget) } : undefined}
      onKeyDown={click ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(e.currentTarget) } } : undefined}
      role={click ? 'button' : undefined}
      tabIndex={click ? 0 : undefined}
      aria-label={uid === null ? 'No Stadium' : `Stadium: ${v.card(uid).name}, ${v.names[owner!]}'s`}
    >
      {uid !== null
        ? <Card uid={uid} className={styles.stadiumCard} />
        : <div className={`${styles.stadiumCard} ${styles.outline}`}>Stadium</div>}
    </div>
  )
}

/** Trainers being played: shown face up until they reach the discard pile. */
export function Resolving() {
  const v = useView()
  if (v.state.resolving.length === 0) return null
  return (
    <div className={styles.resolving} data-zone="resolving" aria-label="Being played">
      {v.state.resolving.map(uid => <Card key={uid} uid={uid} className={styles.resolvingCard} />)}
    </div>
  )
}
