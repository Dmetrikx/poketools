import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDecks } from '@/hooks/useDecks'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { decks, loading, error, createDeck, deleteDeck } = useDecks()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

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
        <h1 className={styles.title}>My Decks</h1>
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
        </form>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.muted}>Loading…</p>}

      {!loading && decks.length === 0 && (
        <p className={styles.muted}>No decks yet. Create one above or import a list.</p>
      )}

      <div className={styles.grid}>
        {decks.map(deck => (
          <div key={deck.id} className={styles.card}>
            <div className={styles.cardBody} onClick={() => navigate(`/decks/${deck.id}`)}>
              <h2 className={styles.deckName}>{deck.name}</h2>
              <p className={styles.deckMeta}>{deck.format}</p>
              <p className={styles.deckDate}>
                {new Date(deck.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className={styles.cardFooter}>
              <button
                className={styles.deleteBtn}
                onClick={() => confirm(`Delete "${deck.name}"?`) && deleteDeck(deck.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
