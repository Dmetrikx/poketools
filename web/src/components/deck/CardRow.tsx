import type { CardEntry } from '@/types/deck'
import styles from './CardRow.module.css'

interface Props {
  entry: CardEntry
  onIncrement: (entry: CardEntry) => void
  onDecrement: (entry: CardEntry) => void
  onRemove: (entry: CardEntry) => void
}

export default function CardRow({ entry, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <div className={styles.row}>
      <div className={styles.countControls}>
        <button
          className={styles.countBtn}
          onClick={() => onDecrement(entry)}
          disabled={entry.count <= 1}
          aria-label="Decrease count"
        >
          −
        </button>
        <span className={styles.count}>{entry.count}</span>
        <button
          className={styles.countBtn}
          onClick={() => onIncrement(entry)}
          aria-label="Increase count"
        >
          +
        </button>
      </div>
      <div className={styles.cardInfo}>
        <span className={styles.name}>{entry.name}</span>
        <span className={styles.set}>{entry.setCode} {entry.number}</span>
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(entry)}
        aria-label="Remove card"
      >
        ×
      </button>
    </div>
  )
}
