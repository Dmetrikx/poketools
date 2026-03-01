import { useState, useEffect, useRef } from 'react'
import type { CardEntry } from '@/types/deck'
import type { CardBrief } from '@/types/card'
import { cardsApi } from '@/api/cards'
import { cardImageUrl } from '@/hooks/useCardImages'
import styles from './CardImageModal.module.css'

interface Props {
  entry: CardEntry
  imageUrl: string | undefined
  onClose: () => void
  onSelectArt: (imageUrl: string) => void
  onSaveArt: (imageUrl: string) => void | Promise<void>
}

export default function CardImageModal({ entry, imageUrl, onClose, onSelectArt, onSaveArt }: Props) {
  const [alts, setAlts] = useState<CardBrief[]>([])
  const [activeUrl, setActiveUrl] = useState<string | undefined>(imageUrl)
  const [saving, setSaving] = useState(false)
  const originalUrl = useRef(imageUrl)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Load all arts for this card name
  useEffect(() => {
    const nameLower = entry.name.toLowerCase()
    cardsApi.search(entry.name).then(results => {
      const matching = results.filter(r => r.name.toLowerCase() === nameLower && r.image)
      setAlts(matching)
    }).catch(() => {})
  }, [entry.name])

  const handleSelectArt = (img: string) => {
    setActiveUrl(img)
    onSelectArt(img)
  }

  const displayUrl = activeUrl ?? imageUrl

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {displayUrl ? (
          <img
            src={cardImageUrl(displayUrl)}
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

        {alts.length > 1 && (
          <div className={styles.altsSection}>
            <div className={styles.altsLabel}>Available arts · click to swap</div>
            <div className={styles.altsStrip}>
              {alts.map(alt => (
                <img
                  key={alt.id}
                  src={cardImageUrl(alt.image!, 'low')}
                  alt={alt.name}
                  title={alt.id}
                  className={`${styles.altThumb} ${alt.image === activeUrl ? styles.altSelected : ''}`}
                  onClick={() => handleSelectArt(alt.image!)}
                />
              ))}
            </div>
          </div>
        )}

        {activeUrl && activeUrl !== originalUrl.current && (
          <button
            className={styles.saveBtn}
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSaveArt(activeUrl)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}