import { useState, useEffect, useRef } from 'react'
import type { CardEntry } from '@/types/deck'
import type { CardBrief } from '@/types/card'
import { cardsApi } from '@/api/cards'
import { cardImageUrl } from '@/hooks/useCardImages'
import styles from './CardImageModal.module.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  entry: CardEntry
  imageUrl: string | undefined
  onClose: () => void
  /** Called on every art pick; a rejected promise reverts the pick. */
  onPickArt: (imageUrl: string) => void | Promise<void>
  /** False when picks are only kept until a later save (import review). */
  autosave?: boolean
}

export default function CardImageModal({ entry, imageUrl, onClose, onPickArt, autosave = true }: Props) {
  const [alts, setAlts] = useState<CardBrief[]>([])
  const [loadingAlts, setLoadingAlts] = useState(true)
  const [activeUrl, setActiveUrl] = useState<string | undefined>(imageUrl)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // Only the latest pick may update the status or revert.
  const pickSeq = useRef(0)

  // Capture phase + stopPropagation: Escape closes only this modal, not a
  // modal it's opened from (the import review).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Load all arts for this card name
  useEffect(() => {
    const nameLower = entry.name.toLowerCase()
    setLoadingAlts(true)
    cardsApi.search(entry.name).then(results => {
      const matching = results.filter(r => r.name.toLowerCase() === nameLower && r.image)
      setAlts(matching)
    }).catch(() => {}).finally(() => setLoadingAlts(false))
  }, [entry.name])

  const handlePick = async (img: string) => {
    if (img === activeUrl) return
    const previous = activeUrl
    const seq = ++pickSeq.current
    setActiveUrl(img)
    setSaveState('saving')
    try {
      await onPickArt(img)
      if (seq === pickSeq.current) setSaveState('saved')
    } catch {
      if (seq === pickSeq.current) {
        setActiveUrl(previous)
        setSaveState('error')
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {activeUrl ? (
          <img
            src={cardImageUrl(activeUrl)}
            alt={entry.name}
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.placeholder}>
            <span>{entry.name}</span>
            <span className={styles.setLabel}>{entry.setCode} {entry.number}</span>
          </div>
        )}

        <div className={styles.info}>
          <span className={styles.name}>{entry.name}</span>
          <span className={styles.setInfo}>{entry.setCode} · {entry.number}</span>
        </div>

        <div className={styles.altsSection}>
          <div className={styles.altsHeader}>
            <span className={styles.altsLabel}>
              {autosave ? 'Choose art · saved automatically' : 'Choose art · saved with the deck'}
            </span>
            <span className={`${styles.status} ${saveState === 'error' ? styles.statusError : ''}`} aria-live="polite">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && (autosave ? 'Saved ✓' : 'Picked ✓')}
              {saveState === 'error' && "Couldn't save art"}
            </span>
          </div>
          {alts.length > 0 ? (
            <div className={styles.altsStrip}>
              {alts.map(alt => (
                <img
                  key={alt.id}
                  src={cardImageUrl(alt.image!, 'low')}
                  alt={alt.name}
                  title={alt.id}
                  className={`${styles.altThumb} ${alt.image === activeUrl ? styles.altSelected : ''}`}
                  onClick={() => handlePick(alt.image!)}
                />
              ))}
            </div>
          ) : (
            <p className={styles.altsEmpty}>{loadingAlts ? 'Loading arts…' : 'No other arts found for this card.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}
