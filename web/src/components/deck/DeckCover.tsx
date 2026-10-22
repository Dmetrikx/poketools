import { useCardImages, imageKey, cardImageUrl } from '@/hooks/useCardImages'
import { MAX_COVERS } from '@/deck/covers'
import type { CardEntry } from '@/types/deck'
import styles from './DeckCover.module.css'

interface Props {
  covers: CardEntry[]
  loading?: boolean
  /** Images already resolved by the caller (e.g. with art-picker overrides). */
  imageMap?: Map<string, string>
  size?: 'small' | 'large'
  /** Makes each slot a button that picks a new card for it. */
  onSelect?: (slot: number) => void
}

/** A deck's two cover cards, fanned like a hand. */
export default function DeckCover({ covers, loading, imageMap, size = 'large', onSelect }: Props) {
  const [ownImages] = useCardImages(covers)
  const images = imageMap ?? ownImages

  const slots = Array.from({ length: MAX_COVERS }, (_, i) => covers[i])

  return (
    <div className={`${styles.cover} ${styles[size]}`}>
      {slots.map((entry, slot) => {
        const img = entry && images.get(imageKey(entry))
        const face = img ? (
          <img src={cardImageUrl(img, 'low')} alt={entry.name} className={styles.img} draggable={false} />
        ) : (
          <div className={`${styles.blank} ${loading ? styles.pulse : ''}`}>
            {entry && !loading && <span>{entry.name}</span>}
          </div>
        )
        const className = `${styles.slot} ${styles[`slot${slot}`]}`

        return onSelect ? (
          <button
            key={slot}
            type="button"
            className={`${className} ${styles.selectable}`}
            onClick={() => onSelect(slot)}
            aria-label={entry ? `Change cover card ${entry.name}` : 'Choose a cover card'}
            title="Change cover card"
          >
            {face}
          </button>
        ) : (
          <div key={slot} className={className}>{face}</div>
        )
      })}
    </div>
  )
}
