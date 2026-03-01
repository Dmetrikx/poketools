import { useState, useEffect, useRef } from 'react'
import type { CardEntry, Section } from '@/types/deck'
import { imageKey, cardImageUrl } from '@/hooks/useCardImages'
import CardImageModal from './CardImageModal'
import styles from './DeckGalleryView.module.css'

const SECTIONS: Section[] = ['pokemon', 'trainer', 'energy']
const LABELS: Record<Section, string> = {
  pokemon: 'Pokémon',
  trainer: 'Trainer',
  energy: 'Energy',
}

interface Props {
  entries: CardEntry[]
  imageMap: Map<string, string>
  onIncrement: (entry: CardEntry) => void
  onDecrement: (entry: CardEntry) => void
  onRemove: (entry: CardEntry) => void
  onSelectArt: (entry: CardEntry, imageUrl: string) => void
}

export default function DeckGalleryView({
  entries,
  imageMap,
  onIncrement,
  onDecrement,
  onRemove,
  onSelectArt,
}: Props) {
  const [modalEntry, setModalEntry] = useState<CardEntry | null>(null)
  const [orderedEntries, setOrderedEntries] = useState<CardEntry[]>(entries)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  // Sync local order when entries change from parent (add/remove)
  useEffect(() => {
    setOrderedEntries(entries)
  }, [entries])

  const handleDragStart = (e: React.DragEvent, entry: CardEntry) => {
    dragId.current = entry.id
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, entry: CardEntry) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(entry.id)
  }

  const handleDragLeave = () => setDragOverId(null)

  const handleDrop = (e: React.DragEvent, target: CardEntry) => {
    e.preventDefault()
    setDragOverId(null)
    const fromId = dragId.current
    if (!fromId || fromId === target.id) return

    setOrderedEntries(prev => {
      const dragged = prev.find(e => e.id === fromId)
      if (!dragged || dragged.section !== target.section) return prev

      const { section } = dragged
      const inSection = prev.filter(e => e.section === section)
      const fromIdx = inSection.findIndex(e => e.id === fromId)
      const toIdx = inSection.findIndex(e => e.id === target.id)
      if (fromIdx === -1 || toIdx === -1) return prev

      const reordered = [...inSection]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)

      return SECTIONS.flatMap(s =>
        s === section ? reordered : prev.filter(e => e.section === s)
      )
    })

    dragId.current = null
  }

  const handleDragEnd = () => {
    dragId.current = null
    setDragOverId(null)
  }

  return (
    <>
      {SECTIONS.map(section => {
        const sectionEntries = orderedEntries.filter(e => e.section === section)
        if (sectionEntries.length === 0) return null
        const total = sectionEntries.reduce((s, e) => s + e.count, 0)

        return (
          <div key={section} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>{LABELS[section]}</span>
              <span className={styles.sectionCount}>{total}</span>
            </div>

            <div className={styles.grid}>
              {sectionEntries.map(entry => {
                const key = imageKey(entry)
                const img = imageMap.get(key)
                const isOver = dragOverId === entry.id

                return (
                  <div
                    key={entry.id}
                    className={`${styles.tile} ${isOver ? styles.dragOver : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, entry)}
                    onDragOver={e => handleDragOver(e, entry)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, entry)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Image — click opens modal */}
                    <div className={styles.imgWrapper} onClick={() => setModalEntry(entry)}>
                      {img ? (
                        <img
                          src={cardImageUrl(img)}
                          alt={entry.name}
                          className={styles.cardImg}
                          draggable={false}
                        />
                      ) : (
                        <div className={styles.placeholder}>
                          <span>{entry.name}</span>
                          <span className={styles.placeholderSet}>{entry.setCode} {entry.number}</span>
                        </div>
                      )}
                      <span className={styles.badge}>×{entry.count}</span>
                    </div>

                    {/* Hover controls */}
                    <div className={styles.controls}>
                      <button
                        className={styles.ctrlBtn}
                        onClick={e => { e.stopPropagation(); onDecrement(entry) }}
                        aria-label="Decrease count"
                      >−</button>
                      <button
                        className={styles.ctrlBtn}
                        onClick={e => { e.stopPropagation(); onIncrement(entry) }}
                        aria-label="Increase count"
                      >+</button>
                      <button
                        className={`${styles.ctrlBtn} ${styles.removeCtrl}`}
                        onClick={e => { e.stopPropagation(); onRemove(entry) }}
                        aria-label="Remove card"
                      >×</button>
                    </div>

                    <div className={styles.label}>{entry.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {modalEntry && (
        <CardImageModal
          entry={modalEntry}
          imageUrl={imageMap.get(imageKey(modalEntry))}
          onClose={() => setModalEntry(null)}
          onSelectArt={url => {
            onSelectArt(modalEntry, url)
          }}
        />
      )}
    </>
  )
}