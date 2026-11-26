import type { JudgeOp, PlayerId } from '@/game/engine/types'
import { GameCard } from './Board'
import { useView } from './view'
import styles from './Game.module.css'

interface Props {
  player: PlayerId
  zone: 'discard' | 'deck'
  judge: boolean
  onJudge: (op: JudgeOp) => void
  onClose: () => void
}

const MOVES: { to: Extract<JudgeOp, { op: 'moveCard' }>['to']; label: string }[] = [
  { to: 'hand', label: 'Hand' }, { to: 'deckTop', label: 'Deck top' }, { to: 'deckBottom', label: 'Deck bottom' },
  { to: 'discard', label: 'Discard' }, { to: 'prizes', label: 'Prizes' },
]

/** A discard pile, or (judge only) a deck in order. */
export default function ZoneViewer({ player, zone, judge, onJudge, onClose }: Props) {
  const v = useView()
  const cards = v.state.players[player][zone]
  const hidden = zone === 'deck' && !judge
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.menuTitle}>
          <span>{v.names[player]}: {zone === 'deck' ? 'Deck' : 'Discard pile'} ({cards.length})</span>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        {hidden ? (
          <p className={styles.muted}>The deck is face down. Turn on Judge to look through it.</p>
        ) : (
          <div className={styles.zoneGrid}>
            {cards.map(uid => (
              <div key={uid} className={styles.zoneCard}>
                <GameCard uid={uid} />
                {judge && (
                  <select
                    className={styles.judgeSelect}
                    value=""
                    onChange={e => e.target.value && onJudge({ op: 'moveCard', uid, to: e.target.value as never })}
                  >
                    <option value="">Move to…</option>
                    {MOVES.filter(m => m.to !== zone).map(m => <option key={m.to} value={m.to}>{m.label}</option>)}
                  </select>
                )}
              </div>
            ))}
            {cards.length === 0 && <p className={styles.muted}>Empty.</p>}
          </div>
        )}
        {judge && zone === 'deck' && (
          <button className={styles.secondary} onClick={() => onJudge({ op: 'shuffleDeck', player })}>Shuffle deck</button>
        )}
      </div>
    </div>
  )
}
