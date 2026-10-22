import { cardImageUrl } from '@/hooks/useCardImages'
import type { CardEntry } from '@/types/deck'
import styles from './PlayingCard.module.css'

interface Props {
  entry: CardEntry
  image: string | undefined
  faceUp: boolean
  onClick?: () => void
  className?: string
  title?: string
}

/** A card that flips between its back and its face. Size comes from the parent via `className`. */
export default function PlayingCard({ entry, image, faceUp, onClick, className, title }: Props) {
  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className ?? ''}`}
      onClick={onClick}
      title={title ?? (faceUp ? entry.name : undefined)}
    >
      <div className={`${styles.inner} ${faceUp ? styles.faceUp : ''}`}>
        <div className={`${styles.side} ${styles.back}`} aria-hidden={faceUp}>
          <div className={styles.backEmblem} />
        </div>
        <div className={`${styles.side} ${styles.front}`} aria-hidden={!faceUp}>
          {image ? (
            <img src={cardImageUrl(image, 'low')} alt={entry.name} draggable={false} />
          ) : (
            <div className={styles.placeholder}>
              {entry.name}
              <small>{entry.setCode} {entry.number}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
