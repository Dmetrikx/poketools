import { useEffect } from 'react'
import { imageKey, cardImageUrl } from '@/hooks/useCardImages'
import type { CardEntry, Section } from '@/types/deck'
import styles from './CoverPickerModal.module.css'

const SECTIONS: Section[] = ['pokemon', 'trainer', 'energy']

interface Props {
  entries: CardEntry[]
  imageMap: Map<string, string>
  /** The card currently in the slot being changed. */
  currentId?: string
  onPick: (entry: CardEntry) => void
  onClose: () => void
}

/** Grid of every card in the deck, to pick one as a cover. */
export default function CoverPickerModal({ entries, imageMap, currentId, onPick, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const ordered = SECTIONS.flatMap(s => entries.filter(e => e.section === s))

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-label="Choose cover card" onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Choose cover card</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.grid}>
          {ordered.map(entry => {
            const img = imageMap.get(imageKey(entry))
            return (
              <button
                key={entry.id}
                type="button"
                className={`${styles.tile} ${entry.id === currentId ? styles.current : ''}`}
                onClick={() => onPick(entry)}
                title={entry.name}
              >
                {img ? (
                  <img src={cardImageUrl(img, 'low')} alt={entry.name} className={styles.img} />
                ) : (
                  <span className={styles.blank}>{entry.name}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
