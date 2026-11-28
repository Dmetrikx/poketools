import { useEffect, useRef } from 'react'
import { useView } from './view'
import ui from './ui.module.css'
import styles from './Overlays.module.css'

/** The game log as a drawer on the right, scrolled to the newest line. */
export default function GameLog({ onClose }: { onClose: () => void }) {
  const v = useView()
  const end = useRef<HTMLDivElement>(null)
  const log = v.state.log
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [log.length])
  return (
    <aside className={`${ui.panel} ${styles.drawer} ${styles.log}`} aria-label="Game log" onClick={e => e.stopPropagation()}>
      <div className={`${ui.panelTitle} ${styles.logHead}`}>
        <span>Log</span>
        <button className={ui.iconBtn} onClick={onClose} aria-label="Close log">×</button>
      </div>
      <div className={styles.logLines}>
        {log.map((l, i) => (
          <div key={i} className={`${styles.logLine} ${i > 0 && l.turn !== log[i - 1].turn ? styles.turnStart : ''}`}>
            <span className={styles.logTurn}>{l.turn || '·'}</span>
            <span>
              {l.player !== null && <span className={`${styles.logWho} ${l.player === 0 ? styles.p0 : styles.p1}`}>{v.names[l.player]} </span>}
              {l.text}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
    </aside>
  )
}
