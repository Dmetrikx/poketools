import type { JudgeOp, PlayerId } from '@/game/engine/types'
import Card from './Card'
import { useView } from './view'
import ui from './ui.module.css'
import styles from './Overlays.module.css'

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

/** A discard pile (newest first), or (Judge only) a deck from the top. */
export default function ZoneViewer({ player, zone, judge, onJudge, onClose }: Props) {
  const v = useView()
  const list = v.state.players[player][zone]
  const cards = zone === 'discard' ? [...list].reverse() : list
  const hidden = zone === 'deck' && !judge
  return (
    <div className={styles.scrim} onClick={e => { e.stopPropagation(); onClose() }}>
      <div className={`${ui.panel} ${styles.viewer}`} role="dialog" aria-label={`${v.names[player]}: ${zone}`} onClick={e => e.stopPropagation()}>
        <div className={ui.panelTitle}>
          <span>{v.names[player]}: {zone === 'deck' ? 'Deck, from the top' : 'Discard pile, newest first'} ({cards.length})</span>
          <button className={ui.iconBtn} onClick={onClose} aria-label="Close" autoFocus>×</button>
        </div>
        {hidden ? (
          <p className={ui.muted}>The deck is face down. Turn on Judge to look through it.</p>
        ) : (
          <div className={styles.zoneGrid}>
            {cards.map(uid => (
              <div key={uid} className={styles.zoneCard}>
                <Card uid={uid} />
                {judge && (
                  <select
                    className={styles.select}
                    value=""
                    aria-label={`Move ${v.card(uid).name}`}
                    onChange={e => e.target.value && onJudge({ op: 'moveCard', uid, to: e.target.value as never })}
                  >
                    <option value="">Move to…</option>
                    {MOVES.filter(m => m.to !== zone).map(m => <option key={m.to} value={m.to}>{m.label}</option>)}
                  </select>
                )}
              </div>
            ))}
            {cards.length === 0 && <p className={ui.muted}>Empty.</p>}
          </div>
        )}
        {judge && zone === 'deck' && (
          <div><button className={ui.secondary} onClick={() => onJudge({ op: 'shuffleDeck', player })}>Shuffle deck</button></div>
        )}
      </div>
    </div>
  )
}
