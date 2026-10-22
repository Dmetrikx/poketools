import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDecks } from '@/hooks/useDecks'
import { useDeckCovers } from '@/hooks/useDeckCovers'
import DeckCover from '@/components/deck/DeckCover'
import ImportDeckModal from '@/components/deck/ImportDeckModal'
import type { DeckSummary } from '@/types/deck'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { decks, loading, error, createDeck, deleteDeck } = useDecks()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showImport, setShowImport] = useState(false)

  // ?import=1 (the navbar's Import link) opens the import modal.
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setShowImport(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const deck = await createDeck(newName.trim())
      navigate(`/decks/${deck.id}`)
    } finally {
      setCreating(false)
      setNewName('')
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Decks</h1>
          <p className={styles.subtitle}>Pick a deck and test draw opening hands.</p>
        </div>
        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            className={styles.input}
            type="text"
            placeholder="New deck name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button className={styles.btn} type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'New Deck'}
          </button>
          <button className={styles.btn} type="button" onClick={() => setShowImport(true)}>
            Import
          </button>
        </form>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.muted}>Loading…</p>}

      {!loading && decks.length === 0 && (
        <p className={styles.muted}>
          No decks yet.{' '}
          <button className={styles.linkBtn} onClick={() => setShowImport(true)}>Import a decklist</button>
          {' '}to start test drawing.
        </p>
      )}

      <div className={styles.grid}>
        {decks.map(deck => (
          <DeckTile
            key={deck.id}
            deck={deck}
            onOpen={() => navigate(`/decks/${deck.id}`)}
            onTestDraw={() => navigate(`/decks/${deck.id}?draw=1`)}
            onDelete={() => confirm(`Delete "${deck.name}"?`) && deleteDeck(deck.id)}
          />
        ))}
      </div>

      {showImport && (
        <ImportDeckModal
          onClose={() => setShowImport(false)}
          onImported={deck => navigate(`/decks/${deck.id}`)}
        />
      )}
    </div>
  )
}

interface TileProps {
  deck: DeckSummary
  onOpen: () => void
  onTestDraw: () => void
  onDelete: () => void
}

function DeckTile({ deck, onOpen, onTestDraw, onDelete }: TileProps) {
  const { covers, loading } = useDeckCovers(deck.id, deck.covers)

  return (
    <div className={styles.card}>
      <div className={styles.cardBody} onClick={onOpen}>
        <DeckCover covers={covers} loading={loading} />
        <h2 className={styles.deckName}>{deck.name}</h2>
        <p className={styles.deckMeta}>
          {deck.format} · {new Date(deck.updated_at).toLocaleDateString()}
        </p>
      </div>
      <div className={styles.cardFooter}>
        <button className={styles.drawBtn} onClick={onTestDraw}>Test draw</button>
        <button className={styles.editBtn} onClick={onOpen}>Edit</button>
        <button className={styles.deleteBtn} onClick={onDelete} aria-label={`Delete ${deck.name}`}>
          Delete
        </button>
      </div>
    </div>
  )
}
