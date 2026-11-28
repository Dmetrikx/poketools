import { useEffect, useState, type CSSProperties } from 'react'
import { PRIZES } from '@/game/engine/rules'
import type { GameState, PlayerId } from '@/game/engine/types'
import type { News } from './useBoardMotion'
import ui from './ui.module.css'
import styles from './Announcer.module.css'

const TURN_MS = 1700
const COIN_MS = 1400
const COIN_STAGGER_MS = 260

/** The turn banner and coin flips, one batch at a time; a click dismisses. */
export default function Announcer({ news, names }: { news: News | null; names: [string, string] }) {
  const [shown, setShown] = useState<News | null>(null)

  useEffect(() => {
    if (!news) return
    setShown(news)
    const coins = news.coins?.length ?? 0
    const ms = Math.max(news.turn ? TURN_MS : 0, coins ? COIN_MS + coins * COIN_STAGGER_MS + 900 : 0)
    const t = window.setTimeout(() => setShown(s => (s?.id === news.id ? null : s)), ms)
    return () => window.clearTimeout(t)
  }, [news])

  if (!shown) return null
  const coins = shown.coins ?? []
  const heads = coins.filter(Boolean).length
  return (
    <div className={styles.layer} onClick={() => setShown(null)} aria-live="polite">
      {shown.turn && (
        <div className={styles.turn} key={`t${shown.id}`}>
          <span className={styles.turnN}>Turn {shown.turn.n}</span>
          <span className={styles.turnName}>{names[shown.turn.player]}</span>
        </div>
      )}
      {coins.length > 0 && (
        <div className={styles.coins} key={`c${shown.id}`} role="status">
          <div className={styles.coinRow}>
            {coins.slice(0, 12).map((h, i) => (
              <span
                key={i}
                className={`${styles.coin} ${h ? styles.heads : styles.tails}`}
                style={{ '--delay': `${i * COIN_STAGGER_MS}ms` } as CSSProperties}
                aria-label={h ? 'Heads' : 'Tails'}
              >
                <span className={styles.faceH}>H</span>
                <span className={styles.faceT}>T</span>
              </span>
            ))}
            {coins.length > 12 && <span className={styles.more}>+{coins.length - 12}</span>}
          </div>
          <span className={styles.tally}>
            {coins.length === 1 ? (heads ? 'Heads' : 'Tails') : `${heads} heads, ${coins.length - heads} tails`}
          </span>
        </div>
      )}
    </div>
  )
}

interface WinProps {
  state: GameState
  names: [string, string]
  canUndo: boolean
  onNewGame: () => void
  onUndo: () => void
  onDecks: () => void
}

/** The end of the game: who won, Prizes left, and what next. Can be put aside to look at the board. */
export function WinScreen({ state, names, canUndo, onNewGame, onUndo, onDecks }: WinProps) {
  const [hidden, setHidden] = useState(false)
  const w = state.winner
  if (w === null) return null
  if (hidden) {
    return <button className={`${ui.primary} ${styles.reopen}`} onClick={e => { e.stopPropagation(); setHidden(false) }}>Game over: show result</button>
  }
  return (
    <div className={styles.winScrim} onClick={e => e.stopPropagation()}>
      <div className={`${ui.panel} ${styles.win}`} role="dialog" aria-label="Game over">
        <span className={styles.winKicker}>Game over</span>
        <strong className={styles.winTitle}>{w === 'draw' ? 'It’s a draw' : `${names[w as PlayerId]} wins`}</strong>
        <div className={styles.score}>
          {([0, 1] as PlayerId[]).map(p => (
            <div key={p} className={`${styles.scoreSide} ${w === p ? styles.winner : ''}`}>
              <span>{names[p]}</span>
              <strong>{PRIZES - state.players[p].prizes.length}</strong>
              <small>Prizes taken</small>
            </div>
          ))}
        </div>
        <div className={styles.winActions}>
          <button className={ui.primary} onClick={onNewGame} autoFocus>New game</button>
          <button className={ui.secondary} onClick={onUndo} disabled={!canUndo}>Undo</button>
          <button className={ui.secondary} onClick={onDecks}>Choose decks</button>
          <button className={ui.ghost} onClick={() => setHidden(true)}>Look at the board</button>
        </div>
      </div>
    </div>
  )
}
