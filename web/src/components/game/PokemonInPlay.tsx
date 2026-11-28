import type { CSSProperties, KeyboardEvent } from 'react'
import { maxHp, remainingHp, slotName } from '@/game/engine/rules'
import type { Slot } from '@/game/engine/types'
import { markClasses, useBoard } from './board'
import Card from './Card'
import { useView } from './view'
import marks from './marks.module.css'
import styles from './PokemonInPlay.module.css'

export const ENERGY_COLOR: Record<string, string> = {
  Grass: '#3fa34d', Fire: '#e0533a', Water: '#3a8be0', Lightning: '#e8c632', Psychic: '#a35bd1',
  Fighting: '#b8743a', Darkness: '#3b3f4f', Metal: '#9aa3ad', Dragon: '#b39a3c', Colorless: '#d9d9d9',
}

const CONDITION: Record<string, string> = {
  asleep: 'Asleep', confused: 'Confused', paralyzed: 'Paralyzed', poisoned: 'Poisoned', burned: 'Burned',
}

/** Past this many attached Energy, identical cards stack as "×N". */
const ENERGY_FAN = 6

interface Props {
  slot: Slot
  active: boolean
}

/** A Pokémon in play: its evolution stack, HP, attachments and conditions. */
export default function PokemonInPlay({ slot, active }: Props) {
  const v = useView()
  const hit = useBoard().slot(slot.id)
  const top = slot.stack[slot.stack.length - 1]
  const lower = slot.stack.slice(0, -1)
  const hp = maxHp(v.ctx, slot)
  const left = remainingHp(v.ctx, slot)
  const effects = v.state.markers.filter(m => m.slot === slot.id)
  const conditions = [slot.rotation, slot.poisoned && 'poisoned', slot.burned && 'burned'].filter(Boolean) as string[]
  const name = slotName(v.ctx, slot)
  const label = `${name}, ${left} of ${hp} HP${conditions.length ? `, ${conditions.map(c => CONDITION[c]).join(', ')}` : ''}`

  const click = hit.onClick
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (click && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      click(e.currentTarget)
    }
  }

  return (
    <div
      className={`${styles.slot} ${active ? styles.active : styles.bench} ${markClasses(hit, marks)} ${click ? styles.clickable : ''}`}
      data-drop={`slot:${slot.id}`}
      data-slot={slot.id}
      onClick={click ? e => { e.stopPropagation(); click(e.currentTarget) } : undefined}
      onPointerDown={hit.onPointerDown}
      onKeyDown={onKey}
      role={click ? 'button' : 'group'}
      tabIndex={click ? 0 : undefined}
      aria-label={label}
      aria-pressed={click && (hit.selected || hit.picked) ? true : undefined}
    >
      <div className={`${styles.cards} ${slot.rotation ? styles[slot.rotation] : ''}`}>
        {lower.map((uid, i) => (
          <Card key={uid} uid={uid} className={styles.under} style={{ '--depth': lower.length - i } as CSSProperties} />
        ))}
        {slot.tools.map(uid => <Card key={uid} uid={uid} className={styles.tool} title={`Tool: ${v.card(uid).name}`} />)}
        <Card uid={top} className={styles.top} title={name} />
      </div>

      <span className={`${styles.hp} ${slot.damage > 0 ? styles.hurt : ''}`} title={`${left} / ${hp} HP`}>
        {left}<small>HP</small>
      </span>
      {slot.damage > 0 && <span className={styles.damage} title={`${slot.damage / 10} damage counters`}>{slot.damage}</span>}

      <Energy uids={slot.energy} />

      {(conditions.length > 0 || effects.length > 0) && (
        <div className={styles.tokens}>
          {conditions.map(c => <span key={c} className={`${styles.token} ${styles[`t_${c}`]}`} title={CONDITION[c]}>{CONDITION[c]}</span>)}
          {effects.length > 0 && (
            <span className={styles.effect} title={`Effects: ${[...new Set(effects.map(m => m.kind))].join(', ')}`} aria-label="Has effects" />
          )}
        </div>
      )}

      {hit.picked && <span className={styles.check} aria-hidden>✓</span>}
      {hit.badge && <span className={styles.badge}>{hit.badge}</span>}
      {hit.stepper && (
        <div className={styles.stepper} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={hit.stepper.dec} disabled={!hit.stepper.dec} aria-label={`Fewer on ${name}`}>−</button>
          <span>{hit.stepper.value}</span>
          <button type="button" onClick={hit.stepper.inc} disabled={!hit.stepper.inc} aria-label={`More on ${name}`}>+</button>
        </div>
      )}
    </div>
  )
}

function Energy({ uids }: { uids: number[] }) {
  const v = useView()
  if (uids.length === 0) return null
  // Identical cards group once there are too many to fan.
  const groups: { uid: number; n: number }[] = []
  if (uids.length > ENERGY_FAN) {
    const byId = new Map<string, { uid: number; n: number }>()
    for (const uid of uids) {
      const id = v.state.cards[uid].cardId
      const g = byId.get(id)
      if (g) g.n++
      else { const ng = { uid, n: 1 }; byId.set(id, ng); groups.push(ng) }
    }
  } else {
    for (const uid of uids) groups.push({ uid, n: 1 })
  }
  return (
    <div className={styles.energy} aria-label={`${uids.length} Energy attached`}>
      {groups.map(({ uid, n }) => {
        const c = v.card(uid)
        const basic = c.subtype === 'Basic'
        return (
          <span key={uid} className={styles.energyItem} data-uid={basic ? uid : undefined}>
            {basic ? (
              <span className={styles.disc} style={{ background: ENERGY_COLOR[c.energyType ?? 'Colorless'] }} title={c.name}>
                {(c.energyType ?? 'C')[0]}
              </span>
            ) : (
              <Card uid={uid} className={styles.thumb} title={c.name} />
            )}
            {n > 1 && <span className={styles.times}>×{n}</span>}
          </span>
        )
      })}
    </div>
  )
}
