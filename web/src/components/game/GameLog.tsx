import { useEffect, useRef } from 'react'
import { useView } from './view'
import styles from './Game.module.css'

export default function GameLog() {
  const v = useView()
  const end = useRef<HTMLDivElement>(null)
  const log = v.state.log
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [log.length])
  return (
    <div className={styles.log}>
      {log.map((l, i) => (
        <div key={i} className={styles.logLine}>
          <span className={styles.logTurn}>{l.turn || '·'}</span>
          {l.player !== null && <span className={styles.logWho}>{v.names[l.player]}</span>}
          <span>{l.text}</span>
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}
