import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useDeck } from '@/hooks/useDeck'
import { useCardImages, imageKey } from '@/hooks/useCardImages'
import { useDeckCovers } from '@/hooks/useDeckCovers'
import CardSearch from '@/components/card/CardSearch'
import SectionGroup from '@/components/deck/SectionGroup'
import DeckGalleryView from '@/components/deck/DeckGalleryView'
import DeckCover from '@/components/deck/DeckCover'
import CoverPickerModal from '@/components/deck/CoverPickerModal'
import PracticeHandModal from '@/components/practice/PracticeHandModal'
import type { CardBrief } from '@/types/card'
import type { CardEntry, Section } from '@/types/deck'
import styles from './DeckEditorPage.module.css'

const SECTIONS: Section[] = ['pokemon', 'trainer', 'energy']
type ViewMode = 'list' | 'gallery'

export default function DeckEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { deck, loading, error, addEntry, updateEntry, updateEntryArt, deleteEntry } = useDeck(id!)

  const [viewMode, setViewMode] = useState<ViewMode>('gallery')
  // ?draw=1 (from a deck tile's Test draw button) opens straight into a draw.
  const [showPractice, setShowPractice] = useState(searchParams.get('draw') === '1')
  const [coverSlot, setCoverSlot] = useState<number | null>(null)

  useEffect(() => {
    if (searchParams.has('draw')) setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Always call hooks before early returns
  const entries = deck?.entries ?? []
  const [imageMap, overrideImage] = useCardImages(entries)
  const { covers, loading: coversLoading, chooseCover } = useDeckCovers(id!, deck ? deck.covers : undefined, deck ? entries : undefined)

  if (loading) return <p className={styles.status}>Loading deck…</p>
  if (error) return <p className={styles.error}>{error}</p>
  if (!deck) return null

  const totalCards = entries.reduce((s, e) => s + e.count, 0)

  const handleCardSelect = async (card: CardBrief, section: Section = 'pokemon') => {
    const existing = entries.find(e =>
      e.cardId === card.id || (e.name === card.name && e.setCode === (card.setId ?? ''))
    )
    if (existing) {
      await updateEntry(existing.id, existing.count + 1)
    } else {
      await addEntry({
        cardId: card.id,
        name: card.name,
        setCode: card.setId ?? '',
        number: card.number ?? '',
        count: 1,
        section,
        position: entries.length,
        imageUrl: '',
      })
    }
  }

  const handleIncrement = async (entry: CardEntry) => {
    await updateEntry(entry.id, entry.count + 1)
  }

  const handleDecrement = async (entry: CardEntry) => {
    if (entry.count <= 1) {
      await deleteEntry(entry.id)
    } else {
      await updateEntry(entry.id, entry.count - 1)
    }
  }

  return (
    <div className={styles.layout}>
      {/* Left: Search panel */}
      <div className={styles.searchPanel}>
        <h2 className={styles.panelTitle}>Add Cards</h2>
        <CardSearch onSelect={card => handleCardSelect(card)} />
      </div>

      {/* Right: Deck panel */}
      <div className={styles.deckPanel}>
        <div className={styles.deckHeader}>
          <div className={styles.deckTitle}>
            <DeckCover
              covers={covers}
              loading={coversLoading}
              imageMap={imageMap}
              size="small"
              onSelect={entries.length > 0 ? setCoverSlot : undefined}
            />
            <div>
              <h1 className={styles.deckName}>{deck.name}</h1>
              <span className={styles.deckCount}>{totalCards} / 60 cards</span>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.drawBtn}
              onClick={() => setShowPractice(true)}
              disabled={entries.length === 0}
            >
              Test draw
            </button>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('list')}
              >List</button>
              <button
                className={`${styles.toggleBtn} ${viewMode === 'gallery' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('gallery')}
              >Gallery</button>
            </div>
            <button className={styles.backBtn} onClick={() => navigate('/')}>
              ← Back
            </button>
          </div>
        </div>

        <div className={styles.entries}>
          {entries.length === 0 && (
            <p className={styles.empty}>Search for cards on the left to build your deck.</p>
          )}

          {viewMode === 'list' && entries.length > 0 && SECTIONS.map(section => (
            <SectionGroup
              key={section}
              section={section}
              entries={entries.filter(e => e.section === section)}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={e => deleteEntry(e.id)}
            />
          ))}

          {viewMode === 'gallery' && entries.length > 0 && (
            <DeckGalleryView
              entries={entries}
              imageMap={imageMap}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={e => deleteEntry(e.id)}
              onSelectArt={(entry, url) => overrideImage(imageKey(entry), url)}
              onSaveArt={async (entry, url) => {
                await updateEntryArt(entry.id, url)
                overrideImage(imageKey(entry), url)
              }}
            />
          )}
        </div>

      </div>

      {showPractice && entries.length > 0 && (
        <PracticeHandModal deck={deck} imageMap={imageMap} onClose={() => setShowPractice(false)} />
      )}

      {coverSlot !== null && (
        <CoverPickerModal
          entries={entries}
          imageMap={imageMap}
          currentId={covers[coverSlot]?.id}
          onPick={entry => {
            chooseCover(coverSlot, entry)
            setCoverSlot(null)
          }}
          onClose={() => setCoverSlot(null)}
        />
      )}
    </div>
  )
}