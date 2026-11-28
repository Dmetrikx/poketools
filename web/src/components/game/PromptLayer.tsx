import { useEffect, useState } from 'react'
import { checkAnswer } from '@/game/engine/prompt'
import type { Prompt } from '@/game/engine/types'
import Card from './Card'
import { answersOnClick, countLine, toggle, type Placement } from './promptPicks'
import { useView } from './view'
import ui from './ui.module.css'
import styles from './PromptLayer.module.css'

interface Props {
  prompt: Prompt
  place: Placement
  picks: number[]
  counts: number[]
  setPicks: (p: number[]) => void
  onAnswer: (a: number[]) => void
}

/**
 * The open prompt. A banner under the top bar always says who is asked and
 * what; Pokémon and hand picks happen on the table itself (the table reads
 * the same picks), other card picks in a tray, and option picks in a dialog.
 */
export default function PromptLayer({ prompt, place, picks, counts, setPicks, onAnswer }: Props) {
  const v = useView()
  const answer = prompt.kind === 'distribute' ? counts : picks
  const err = checkAnswer(prompt, answer)
  const placed = prompt.kind === 'distribute' ? counts.reduce((x, y) => x + y, 0) : picks.length
  const line = countLine(prompt, placed)
  const confirmHere = (place === 'board' || place === 'hand') && !answersOnClick(prompt)

  // Enter confirms, unless focus is on a button (which Enter presses).
  useEffect(() => {
    if (place === 'dialog') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || err) return
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return
      e.preventDefault()
      onAnswer(answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [place, err, answer, onAnswer])

  return (
    <>
      <div className={styles.banner} role="status" aria-live="polite" onClick={e => e.stopPropagation()}>
        <span className={styles.who}>{v.names[prompt.player]}</span>
        <strong className={styles.title}>{prompt.title}</strong>
        {line && <span className={styles.count}>{line}</span>}
        {confirmHere && <Confirm prompt={prompt} answer={answer} err={err} onAnswer={onAnswer} />}
      </div>
      {place === 'tray' && (prompt.kind === 'chooseCards' || prompt.kind === 'order') && (
        <Tray prompt={prompt} picks={picks} setPicks={setPicks} err={err} onAnswer={onAnswer} />
      )}
      {place === 'dialog' && <Dialog prompt={prompt} onAnswer={onAnswer} />}
    </>
  )
}

function Confirm({ prompt, answer, err, onAnswer }: { prompt: Prompt; answer: number[]; err: string | null; onAnswer: (a: number[]) => void }) {
  const none = prompt.kind !== 'distribute' && prompt.kind !== 'order' && answer.length === 0
  const label = prompt.kind === 'distribute' || prompt.kind === 'order'
    ? 'Confirm'
    : answer.length ? `Confirm (${answer.length})` : !err && none ? 'Choose none' : 'Confirm'
  return (
    <button className={ui.primary} disabled={!!err} onClick={() => onAnswer(answer)} title={err ?? undefined}>
      {label}
    </button>
  )
}

interface TrayProps {
  prompt: Extract<Prompt, { kind: 'chooseCards' | 'order' }>
  picks: number[]
  setPicks: (p: number[]) => void
  err: string | null
  onAnswer: (a: number[]) => void
}

/** Large cards to pick from (or to put in order), with a peek at the board behind. */
function Tray({ prompt, picks, setPicks, err, onAnswer }: TrayProps) {
  const [peek, setPeek] = useState(false)
  const cards = prompt.kind === 'order' ? prompt.cards : prompt.options
  const max = prompt.kind === 'order' ? cards.length : prompt.max
  const faceUp = !(prompt.kind === 'chooseCards' && prompt.hidden)
  const single = prompt.kind === 'chooseCards' && answersOnClick(prompt)

  const pick = (uid: number) => {
    if (single) onAnswer([uid])
    else setPicks(toggle(picks, uid, max))
  }

  return (
    <div className={`${styles.scrim} ${peek ? styles.peeking : ''}`} onClick={e => e.stopPropagation()}>
      <div className={`${ui.panel} ${styles.tray}`} role="dialog" aria-label={prompt.title}>
        <div className={styles.trayCards}>
          {cards.map(uid => {
            const on = picks.includes(uid)
            return (
              <button key={uid} type="button" className={`${styles.trayCard} ${on ? styles.on : ''}`} onClick={() => pick(uid)} aria-pressed={on}>
                <Card uid={uid} faceUp={faceUp} />
                {on && <span className={styles.badge}>{prompt.kind === 'order' ? picks.indexOf(uid) + 1 : '✓'}</span>}
              </button>
            )
          })}
          {cards.length === 0 && <p className={ui.muted}>There are no cards to choose.</p>}
        </div>
        <div className={styles.trayActions}>
          {!single && <Confirm prompt={prompt} answer={picks} err={err} onAnswer={onAnswer} />}
          {prompt.kind === 'order' && picks.length > 0 && <button className={ui.secondary} onClick={() => setPicks([])}>Reset</button>}
          <span className={styles.spacer} />
          <button className={ui.secondary} onClick={() => setPeek(true)}>Peek at board</button>
        </div>
      </div>
      {peek && <button className={`${ui.primary} ${styles.back}`} onClick={() => setPeek(false)}>Back to the choice</button>}
    </div>
  )
}

function Dialog({ prompt, onAnswer }: { prompt: Prompt; onAnswer: (a: number[]) => void }) {
  const [peek, setPeek] = useState(false)
  return (
    <div className={`${styles.scrim} ${peek ? styles.peeking : ''}`} onClick={e => e.stopPropagation()}>
      <div className={`${ui.panel} ${styles.dialog}`} role="dialog" aria-label={prompt.title}>
        <strong className={styles.dialogTitle}>{prompt.title}</strong>
        <div className={styles.options}>
          {prompt.kind === 'yesNo' && (
            <>
              <button className={ui.primary} autoFocus onClick={() => onAnswer([1])}>Yes</button>
              <button className={ui.secondary} onClick={() => onAnswer([0])}>No</button>
            </>
          )}
          {prompt.kind === 'chooseOption' && prompt.options.map((o, i) => (
            <button key={i} className={i === 0 ? ui.primary : ui.secondary} autoFocus={i === 0} onClick={() => onAnswer([i])}>{o}</button>
          ))}
        </div>
        <button className={`${ui.ghost} ${styles.peekLink}`} onClick={() => setPeek(true)}>Peek at board</button>
      </div>
      {peek && <button className={`${ui.primary} ${styles.back}`} onClick={() => setPeek(false)}>Back to the choice</button>}
    </div>
  )
}
