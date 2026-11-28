import type { CSSProperties, PointerEvent } from 'react'
import PlayingCard from '@/components/practice/PlayingCard'
import { useView } from './view'
import styles from './Card.module.css'

interface Props {
  uid: number
  faceUp?: boolean
  /** Sets the card's width through `--cw`; height follows from the aspect ratio. */
  className?: string
  style?: CSSProperties
  onClick?: () => void
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void
  title?: string
}

/**
 * One physical card on the table. The wrapper carries `data-uid` so the
 * motion layer can find where a card is drawn; PlayingCard supplies the
 * face, back, flip and hover preview.
 */
export default function Card({ uid, faceUp = true, className, style, onClick, onPointerDown, title }: Props) {
  const v = useView()
  return (
    <div className={`${styles.wrap} ${className ?? ''}`} style={style} data-uid={uid} onPointerDown={onPointerDown}>
      <PlayingCard entry={v.entry(uid)} image={v.image(uid)} faceUp={faceUp} onClick={onClick} className={styles.fill} title={title} />
    </div>
  )
}
