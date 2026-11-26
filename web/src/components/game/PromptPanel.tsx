import { useState } from 'react'
import { gameDb } from '@/game/db'
import { checkAnswer } from '@/game/engine/prompt'
import { findSlot } from '@/game/engine/rules'
import type { Prompt } from '@/game/engine/types'
import { GameCard, PokemonSlot } from './Board'
import { useView } from './view'
import styles from './Game.module.css'

interface Props {
  prompt: Prompt
  onAnswer: (a: number[]) => void
}

/** Asks the player a prompt names; the board stays visible above it. */
export default function PromptPanel({ prompt, onAnswer }: Props) {
  const v = useView()
  // Remount per prompt so picks never carry over.
  const key = JSON.stringify(prompt)
  return (
    <div className={styles.prompt} role="dialog" aria-label={prompt.title}>
      <div className={styles.promptHeader}>
        <span className={styles.promptWho}>{v.names[prompt.player]}</span>
        <strong>{prompt.title}</strong>
      </div>
      <Body key={key} prompt={prompt} onAnswer={onAnswer} />
    </div>
  )
}

function Body({ prompt, onAnswer }: Props) {
  const v = useView()
  const [picks, setPicks] = useState<number[]>([])
  const [counts, setCounts] = useState<number[]>(() => (prompt.kind === 'distribute' ? prompt.options.map(() => 0) : []))

  const toggle = (id: number, max: number) =>
    setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : max === 1 ? [id] : p.length < max ? [...p, id] : p))

  switch (prompt.kind) {
    case 'yesNo':
      return (
        <div className={styles.promptActions}>
          <button className={styles.primary} onClick={() => onAnswer([1])}>Yes</button>
          <button className={styles.secondary} onClick={() => onAnswer([0])}>No</button>
        </div>
      )

    case 'chooseOption':
      return (
        <div className={styles.promptActions}>
          {prompt.options.map((o, i) => (
            <button key={i} className={i === 0 ? styles.primary : styles.secondary} onClick={() => onAnswer([i])}>{o}</button>
          ))}
        </div>
      )

    case 'chooseCards':
    case 'order': {
      const options = prompt.kind === 'order' ? prompt.cards : prompt.options
      const max = prompt.kind === 'order' ? options.length : prompt.max
      const answer = picks
      const err = checkAnswer(prompt, answer)
      return (
        <>
          <p className={styles.muted}>
            {prompt.kind === 'order'
              ? 'Click the cards in order, first to last.'
              : `Choose ${prompt.min === prompt.max ? prompt.min : `${Math.min(prompt.min, options.length)}–${prompt.max}`}.`}
          </p>
          <div className={styles.promptCards}>
            {options.map(uid => (
              <div key={uid} className={styles.promptPick}>
                <GameCard uid={uid} faceUp={!(prompt.kind === 'chooseCards' && prompt.hidden)} selected={picks.includes(uid)} onClick={() => toggle(uid, max)} />
                {prompt.kind === 'order' && picks.includes(uid) && <span className={styles.orderBadge}>{picks.indexOf(uid) + 1}</span>}
              </div>
            ))}
          </div>
          <div className={styles.promptActions}>
            <button className={styles.primary} disabled={!!err} onClick={() => onAnswer(answer)}>
              {answer.length ? `Confirm (${answer.length})` : prompt.kind === 'chooseCards' && prompt.min > 0 && options.length > 0 ? 'Confirm' : 'Choose none'}
            </button>
            {err && answer.length > 0 && <span className={styles.muted}>{err}</span>}
          </div>
        </>
      )
    }

    case 'choosePokemon': {
      const err = checkAnswer(prompt, picks)
      return (
        <>
          <div className={styles.promptCards}>
            {prompt.options.map(id => {
              const f = findSlot({ s: v.state, db: gameDb }, id)
              return f ? (
                <PokemonSlot key={id} slot={f.slot} active={f.active} selected={picks.includes(id)} onClick={() => toggle(id, prompt.max)} />
              ) : null
            })}
          </div>
          <div className={styles.promptActions}>
            <button className={styles.primary} disabled={!!err} onClick={() => onAnswer(picks)}>
              {picks.length || prompt.min > 0 ? 'Confirm' : 'Choose none'}
            </button>
          </div>
        </>
      )
    }

    case 'distribute': {
      const total = counts.reduce((a, b) => a + b, 0)
      return (
        <>
          <p className={styles.muted}>Place {prompt.total} in any way you like ({prompt.total - total} left).</p>
          <div className={styles.promptCards}>
            {prompt.options.map((id, i) => {
              const f = findSlot({ s: v.state, db: gameDb }, id)
              if (!f) return null
              const set = (d: number) => setCounts(c => c.map((n, j) => (j === i ? Math.max(0, n + d) : n)))
              return (
                <div key={id} className={styles.promptPick}>
                  <PokemonSlot slot={f.slot} active={f.active} />
                  <div className={styles.stepper}>
                    <button onClick={() => set(-1)} disabled={!counts[i]}>−</button>
                    <span>{counts[i]}</span>
                    <button onClick={() => set(1)} disabled={total >= prompt.total}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={styles.promptActions}>
            <button className={styles.primary} disabled={!!checkAnswer(prompt, counts)} onClick={() => onAnswer(counts)}>Confirm</button>
          </div>
        </>
      )
    }
  }
}
