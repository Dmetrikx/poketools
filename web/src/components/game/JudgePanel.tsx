import { gameDb } from '@/game/db'
import { findSlot, slotName } from '@/game/engine/rules'
import type { JudgeOp, PlayerId } from '@/game/engine/types'
import { useView } from './view'
import styles from './Game.module.css'

interface Props {
  slotId: number | null
  handCard: number | null
  onJudge: (op: JudgeOp) => void
  onClose: () => void
}

/** Manual fixes for the selected Pokémon or hand card, and for each player. */
export default function JudgePanel({ slotId, handCard, onJudge, onClose }: Props) {
  const v = useView()
  const f = slotId === null ? null : findSlot({ s: v.state, db: gameDb }, slotId)
  return (
    <div className={styles.menu}>
      <div className={styles.menuTitle}>
        <span>Judge{f ? `: ${slotName({ s: v.state, db: gameDb }, f.slot)}` : handCard !== null ? `: ${v.card(handCard).name}` : ''}</span>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close">×</button>
      </div>
      {f && (
        <>
          <div className={styles.judgeRow}>
            <span>Damage {f.slot.damage}</span>
            <button className={styles.secondary} onClick={() => onJudge({ op: 'setDamage', slot: f.slot.id, damage: Math.max(0, f.slot.damage - 10) })}>−10</button>
            <button className={styles.secondary} onClick={() => onJudge({ op: 'setDamage', slot: f.slot.id, damage: f.slot.damage + 10 })}>+10</button>
          </div>
          <div className={styles.judgeRow}>
            {(['asleep', 'confused', 'paralyzed', 'poisoned', 'burned', 'none'] as const).map(c => (
              <button key={c} className={styles.secondary} onClick={() => onJudge({ op: 'setCondition', slot: f.slot.id, condition: c })}>{c === 'none' ? 'Clear' : c}</button>
            ))}
          </div>
          <div className={styles.judgeRow}>
            <span>Top card to</span>
            <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid: f.slot.stack[f.slot.stack.length - 1], to: 'hand' })}>Hand</button>
            <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid: f.slot.stack[f.slot.stack.length - 1], to: 'discard' })}>Discard</button>
          </div>
          {[...f.slot.energy, ...f.slot.tools].map(uid => (
            <div key={uid} className={styles.judgeRow}>
              <span>{v.card(uid).name}</span>
              <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid, to: 'hand' })}>To hand</button>
              <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid, to: 'discard' })}>Discard</button>
            </div>
          ))}
        </>
      )}
      {handCard !== null && (
        <div className={styles.judgeRow}>
          <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'discard' })}>Discard</button>
          <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'deckTop' })}>Deck top</button>
          <button className={styles.secondary} onClick={() => onJudge({ op: 'moveCard', uid: handCard, to: 'deckBottom' })}>Deck bottom</button>
        </div>
      )}
      {([0, 1] as PlayerId[]).map(p => (
        <div key={p} className={styles.judgeRow}>
          <span>{v.names[p]}</span>
          <button className={styles.secondary} onClick={() => onJudge({ op: 'draw', player: p })}>Draw</button>
          <button className={styles.secondary} onClick={() => onJudge({ op: 'resetFlags', player: p })}>Reset turn limits</button>
        </div>
      ))}
    </div>
  )
}
