import { findSlot, slotName } from '@/game/engine/rules'
import type { JudgeOp, PlayerId } from '@/game/engine/types'
import { useView } from './view'
import ui from './ui.module.css'
import styles from './Overlays.module.css'

interface Props {
  slotId: number | null
  handCard: number | null
  onJudge: (op: JudgeOp) => void
  onClose: () => void
}

/** Manual fixes for the selected Pokémon or hand card, and for each player. */
export default function JudgePanel({ slotId, handCard, onJudge, onClose }: Props) {
  const v = useView()
  const f = slotId === null ? null : findSlot(v.ctx, slotId)
  const btn = `${ui.secondary} ${styles.small}`
  return (
    <aside className={`${ui.panel} ${styles.drawer} ${styles.judge}`} aria-label="Judge" onClick={e => e.stopPropagation()}>
      <div className={ui.panelTitle}>
        <span>Judge{f ? `: ${slotName(v.ctx, f.slot)}` : handCard !== null ? `: ${v.card(handCard).name}` : ''}</span>
        <button className={ui.iconBtn} onClick={onClose} aria-label="Close Judge">×</button>
      </div>
      {!f && handCard === null && <p className={ui.muted}>Click any Pokémon or hand card to fix it by hand.</p>}
      {f && (
        <div className={styles.section}>
          <div className={styles.row}>
            <span>Damage {f.slot.damage}</span>
            <button className={btn} onClick={() => onJudge({ op: 'setDamage', slot: f.slot.id, damage: Math.max(0, f.slot.damage - 10) })}>−10</button>
            <button className={btn} onClick={() => onJudge({ op: 'setDamage', slot: f.slot.id, damage: f.slot.damage + 10 })}>+10</button>
          </div>
          <div className={styles.row}>
            {(['asleep', 'confused', 'paralyzed', 'poisoned', 'burned', 'none'] as const).map(c => (
              <button key={c} className={btn} onClick={() => onJudge({ op: 'setCondition', slot: f.slot.id, condition: c })}>{c === 'none' ? 'Clear' : c}</button>
            ))}
          </div>
          <div className={styles.row}>
            <span>Top card to</span>
            <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid: f.slot.stack[f.slot.stack.length - 1], to: 'hand' })}>Hand</button>
            <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid: f.slot.stack[f.slot.stack.length - 1], to: 'discard' })}>Discard</button>
          </div>
          {[...f.slot.energy, ...f.slot.tools].map(uid => (
            <div key={uid} className={styles.row}>
              <span>{v.card(uid).name}</span>
              <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid, to: 'hand' })}>To hand</button>
              <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid, to: 'discard' })}>Discard</button>
            </div>
          ))}
        </div>
      )}
      {handCard !== null && (
        <div className={styles.section}>
          <div className={styles.row}>
            <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'discard' })}>Discard</button>
            <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'deckTop' })}>Deck top</button>
            <button className={btn} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'deckBottom' })}>Deck bottom</button>
          </div>
        </div>
      )}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Players</span>
        {([0, 1] as PlayerId[]).map(p => (
          <div key={p} className={styles.row}>
            <span>{v.names[p]}</span>
            <button className={btn} onClick={() => onJudge({ op: 'draw', player: p })}>Draw</button>
            <button className={btn} onClick={() => onJudge({ op: 'resetFlags', player: p })}>Reset turn limits</button>
          </div>
        ))}
      </div>
    </aside>
  )
}
