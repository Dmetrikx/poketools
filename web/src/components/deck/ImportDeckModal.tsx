import { useState, useEffect, useMemo } from 'react'
import { decksApi } from '@/api/decks'
import { useCardImages, imageKey } from '@/hooks/useCardImages'
import DeckGalleryView from './DeckGalleryView'
import type { CardEntry, Deck } from '@/types/deck'
import styles from './ImportDeckModal.module.css'

type Formatter = 'ptcglive' | 'limitless'

interface Props {
  onClose: () => void
  onImported: (deck: Deck) => void
}

/**
 * Two steps: paste a decklist, then review the parsed deck and fix any art
 * before it's created. Art picks stay local until "Save deck", which sends
 * them along with the list so the deck is saved in one request.
 */
export default function ImportDeckModal({ onClose, onImported }: Props) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [formatter, setFormatter] = useState<Formatter>('ptcglive')
  const [preview, setPreview] = useState<CardEntry[] | null>(null)
  // imageKey → picked art. Kept across Back so re-previewing keeps the picks.
  const [picks, setPicks] = useState<Map<string, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entries = preview ?? []
  const [autoImages] = useCardImages(entries)
  // Picks are overlaid here instead of overrideImage, which would put an
  // unsaved art into the shared image cache.
  const imageMap = useMemo(() => {
    const m = new Map(autoImages)
    picks.forEach((url, key) => m.set(key, url))
    return m
  }, [autoImages, picks])

  const requestClose = () => {
    if (text.trim() && !confirm('Discard this import?')) return
    onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const parsed = await decksApi.import(text, { formatter, save: false })
      if (!parsed.entries?.length) {
        setError('No cards found. Check the format and try again.')
        return
      }
      // Parsed entries have no IDs yet; the gallery needs them as keys.
      setPreview(parsed.entries.map((entry, i) => ({ ...entry, id: `preview-${i}` })))
      if (!name.trim() && parsed.name) setName(parsed.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read decklist')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      const deck = await decksApi.import(text, {
        name: name.trim() || 'Imported Deck',
        formatter,
        save: true,
        imageUrls: entries.map(entry => picks.get(imageKey(entry)) ?? ''),
      })
      onImported(deck)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setBusy(false)
    }
  }

  const pickArt = (entry: CardEntry, url: string) => {
    setPicks(prev => new Map(prev).set(imageKey(entry), url))
  }

  const totalCards = entries.reduce((s, e) => s + e.count, 0)

  return (
    <div className={styles.overlay} onClick={requestClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-label="Import deck"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Import deck</h2>
            <p className={styles.steps}>
              <span className={!preview ? styles.stepActive : ''}>1. Paste list</span>
              {' · '}
              <span className={preview ? styles.stepActive : ''}>2. Review art</span>
            </p>
          </div>
          <button className={styles.closeBtn} onClick={requestClose} aria-label="Close">×</button>
        </div>

        {!preview ? (
          <form id="import-paste" onSubmit={handlePreview} className={styles.body}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="import-name">Deck name (optional)</label>
                <input
                  id="import-name"
                  className={styles.input}
                  type="text"
                  placeholder="My Charizard Deck"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="import-format">Format</label>
                <select
                  id="import-format"
                  className={styles.input}
                  value={formatter}
                  onChange={e => setFormatter(e.target.value as Formatter)}
                >
                  <option value="ptcglive">PTCG Live</option>
                  <option value="limitless">Limitless TCG</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="import-text">Decklist</label>
              <textarea
                id="import-text"
                className={`${styles.input} ${styles.textarea}`}
                placeholder={`Pokémon: 4\n4 Charizard ex OBF 125\n\nTrainer: 6\n4 Professor's Research SVI 190\n…`}
                value={text}
                onChange={e => setText(e.target.value)}
                rows={14}
                autoFocus
              />
            </div>
          </form>
        ) : (
          <div className={styles.body}>
            <div className={styles.reviewHeader}>
              <input
                className={`${styles.input} ${styles.nameInput}`}
                type="text"
                aria-label="Deck name"
                placeholder="Imported Deck"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <span className={styles.count}>{totalCards} cards</span>
            </div>
            <p className={styles.hint}>
              Tap any card to choose a different art. Your picks are saved with the deck.
            </p>
            <DeckGalleryView entries={entries} imageMap={imageMap} onPickArt={pickArt} readOnly />
          </div>
        )}

        <div className={styles.footer}>
          {error && <p className={styles.error}>{error}</p>}
          {!preview ? (
            <button
              className={styles.primaryBtn}
              type="submit"
              form="import-paste"
              disabled={busy || !text.trim()}
            >
              {busy ? 'Reading…' : 'Preview →'}
            </button>
          ) : (
            <>
              <button
                className={styles.secondaryBtn}
                onClick={() => { setPreview(null); setError(null) }}
                disabled={busy}
              >
                ← Edit list
              </button>
              <button className={styles.primaryBtn} onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : 'Save deck'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
