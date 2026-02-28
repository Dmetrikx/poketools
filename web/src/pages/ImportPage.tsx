import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksApi } from '@/api/decks'
import styles from './ImportPage.module.css'

type Formatter = 'ptcglive' | 'limitless'

export default function ImportPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [formatter, setFormatter] = useState<Formatter>('ptcglive')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const deck = await decksApi.import(text, {
        name: name.trim() || 'Imported Deck',
        formatter,
        save: true,
      })
      navigate(`/decks/${deck.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Import Deck</h1>
      <p className={styles.subtitle}>
        Paste a decklist in PTCG Live or Limitless TCG format.
      </p>

      <form onSubmit={handleImport} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">Deck name (optional)</label>
            <input
              id="name"
              className={styles.input}
              type="text"
              placeholder="My Charizard Deck"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="format">Format</label>
            <select
              id="format"
              className={styles.select}
              value={formatter}
              onChange={e => setFormatter(e.target.value as Formatter)}
            >
              <option value="ptcglive">PTCG Live</option>
              <option value="limitless">Limitless TCG</option>
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="text">Decklist</label>
          <textarea
            id="text"
            className={styles.textarea}
            placeholder={`Pokémon: 4\n4 Charizard ex OBF 125\n\nTrainer: 6\n4 Professor's Research SVI 190\n…`}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={18}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            className={styles.importBtn}
            type="submit"
            disabled={loading || !text.trim()}
          >
            {loading ? 'Importing…' : 'Import & Save Deck'}
          </button>
        </div>
      </form>
    </div>
  )
}
