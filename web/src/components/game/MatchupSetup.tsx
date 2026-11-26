import { useEffect, useState } from 'react'
import { decksApi } from '@/api/decks'
import { useDecks } from '@/hooks/useDecks'
import type { Deck } from '@/types/deck'
import { resolveDeck } from './resolveDeck'
import styles from './Game.module.css'

interface Props {
  initialA: string | null
  onStart: (a: string, b: string) => void
}

/** Pick two of your decks; each shows whether the simulator supports it. */
export default function MatchupSetup({ initialA, onStart }: Props) {
  const { decks, loading } = useDecks()
  const [a, setA] = useState(initialA ?? '')
  const [b, setB] = useState('')
  const okA = useSupport(a)
  const okB = useSupport(b)

  if (loading) return <p className={styles.muted}>Loading decks…</p>
  if (decks.length === 0) return <p className={styles.muted}>Import two decks to play a matchup.</p>

  const picker = (label: string, value: string, set: (v: string) => void, status: Support) => (
    <div className={styles.setupDeck}>
      <label className={styles.setupLabel}>
        {label}
        <select className={styles.setupSelect} value={value} onChange={e => set(e.target.value)}>
          <option value="">Choose a deck…</option>
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <SupportNote status={status} />
    </div>
  )

  return (
    <div className={styles.setup}>
      <h1 className={styles.setupTitle}>Play a matchup</h1>
      <p className={styles.muted}>Play both sides on one screen. The card pool is LAIC 2026–27 São Paulo.</p>
      <div className={styles.setupDecks}>
        {picker('Player 1', a, setA, okA)}
        {picker('Player 2', b, setB, okB)}
      </div>
      <button className={styles.primary} disabled={!a || !b || okA.state !== 'ok' || okB.state !== 'ok'} onClick={() => onStart(a, b)}>
        Start
      </button>
    </div>
  )
}

type Support =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ok'; pending: string[] }
  | { state: 'bad'; reason: string; cards?: string[] }

function useSupport(id: string): Support {
  const [s, setS] = useState<Support>({ state: 'none' })
  useEffect(() => {
    if (!id) { setS({ state: 'none' }); return }
    let live = true
    setS({ state: 'loading' })
    decksApi.get(id).then((deck: Deck) => {
      if (!live) return
      const r = resolveDeck(deck.entries ?? [])
      if (r.unsupported.length) setS({ state: 'bad', reason: 'Cards outside the LAIC pool:', cards: r.unsupported.map(e => `${e.name} ${e.setCode} ${e.number}`) })
      else if (r.count !== 60) setS({ state: 'bad', reason: `The deck has ${r.count} cards, not 60.` })
      else setS({ state: 'ok', pending: r.pendingNames })
    }).catch(() => live && setS({ state: 'bad', reason: 'Couldn\'t load the deck.' }))
    return () => { live = false }
  }, [id])
  return s
}

function SupportNote({ status }: { status: Support }) {
  if (status.state === 'none') return null
  if (status.state === 'loading') return <p className={styles.muted}>Checking…</p>
  if (status.state === 'bad') {
    return (
      <div className={styles.setupBad}>
        <p>{status.reason}</p>
        {status.cards && <ul>{status.cards.map(c => <li key={c}>{c}</li>)}</ul>}
      </div>
    )
  }
  return (
    <div className={styles.setupOk}>
      <p>Every card is in the pool.</p>
      {status.pending.length > 0 && (
        <details>
          <summary>{status.pending.length} cards' effects aren't automated yet</summary>
          <p className={styles.muted}>They play with their printed damage only; use Judge to apply the rest.</p>
          <ul>{status.pending.map(n => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
    </div>
  )
}
