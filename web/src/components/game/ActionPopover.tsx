import { useLayoutEffect, useRef, useState } from 'react'
import { actionKey } from '@/game/engine/actions'
import { attackCost, findSlot, retreatCost, slotName, topCard, usableAttacks } from '@/game/engine/rules'
import type { Action, EnergyType } from '@/game/engine/types'
import { actionLabel } from './labels'
import { ENERGY_COLOR } from './PokemonInPlay'
import { dropTargets, popoverActions, slotTargets, type Source } from './targets'
import type { GameView } from './view'
import ui from './ui.module.css'
import styles from './ActionPopover.module.css'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface PopItem {
  key: string
  label: string
  /** Attack cost, drawn as Energy pips. */
  cost?: EnergyType[]
  /** Printed damage or a short note on the right. */
  detail?: string
  /** Rules text, shown smaller under the label. */
  text?: string
  /** No action: shown greyed out, for information. */
  action?: Action
}

export interface Pop {
  rect: Rect
  title: string
  items: PopItem[]
  hint?: string
}

const MARGIN = 8

interface Props extends Pop {
  onAct: (a: Action) => void
  onClose: () => void
}

/** The actions for the selected card, anchored to it. Above the card if it fits, else below. */
export default function ActionPopover({ rect, title, items, hint, onAct, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight
    let left = rect.left + rect.width / 2 - w / 2
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - w - MARGIN)
    let top = rect.top - h - 10
    if (top < MARGIN) top = rect.top + rect.height + 10
    top = Math.min(Math.max(MARGIN, top), window.innerHeight - h - MARGIN)
    setPos({ left, top })
  }, [rect, items.length])

  const first = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => { first.current?.focus({ preventScroll: true }) }, [])

  let firstEnabled = true
  return (
    <div
      ref={ref}
      className={`${ui.panel} ${styles.pop}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
      role="menu"
      aria-label={title}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className={ui.panelTitle}>
        <span className={styles.title}>{title}</span>
        <button className={ui.iconBtn} onClick={onClose} aria-label="Close">×</button>
      </div>
      {items.map(item => {
        const enabled = !!item.action
        const isFirst = enabled && firstEnabled
        if (isFirst) firstEnabled = false
        return (
          <button
            key={item.key}
            ref={isFirst ? first : undefined}
            role="menuitem"
            className={styles.item}
            disabled={!enabled}
            onClick={() => item.action && onAct(item.action)}
          >
            <span className={styles.main}>
              {item.cost && (
                <span className={styles.cost} aria-label={`Cost: ${item.cost.join(', ') || 'none'}`}>
                  {item.cost.length === 0 && <span className={styles.free}>–</span>}
                  {item.cost.map((t, i) => <span key={i} className={styles.pip} style={{ background: ENERGY_COLOR[t] }} title={t} />)}
                </span>
              )}
              <span className={styles.label}>{item.label}</span>
              {item.detail && <span className={styles.detail}>{item.detail}</span>}
            </span>
            {item.text && <span className={styles.text}>{item.text}</span>}
          </button>
        )
      })}
      {items.length === 0 && !hint && <p className={ui.muted}>Nothing to do with this card right now.</p>}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}

const item = (a: Action, label: string, extra: Partial<PopItem> = {}): PopItem => ({ key: actionKey(a), label, action: a, ...extra })

/** The popover for a picked-up hand card or Pokémon. */
export function sourcePop(v: GameView, legal: Action[], src: Source, rect: Rect): Pop {
  const s = v.state
  const zones = dropTargets(s, legal, src)
  const targets = slotTargets(zones)

  if (src.kind === 'hand') {
    const items = popoverActions(s, legal, src).map(a => item(a, actionLabel(s, a)))
    const hint = targets.size ? `Drag it onto a highlighted Pokémon, or click one.` : undefined
    return { rect, title: v.card(src.uid).name, items, hint }
  }

  const found = findSlot(v.ctx, src.id)!
  const slot = found.slot
  const keys = new Set(legal.map(actionKey))
  const items: PopItem[] = []
  if (found.active) {
    for (const u of usableAttacks(v.ctx, slot)) {
      const a: Action = u.own ? { type: 'attack', attack: u.attack.name } : { type: 'attack', attack: u.attack.name, source: u.cardId }
      const ok = keys.has(actionKey(a))
      items.push({
        key: actionKey(a),
        label: u.attack.name + (u.own ? '' : ` (${v.ctx.db.card(u.cardId).name})`),
        cost: attackCost(v.ctx, slot, u.attack),
        detail: u.attack.damage || undefined,
        text: u.attack.text || undefined,
        action: ok ? a : undefined,
      })
    }
  }
  for (const ab of topCard(v.ctx, slot).abilities ?? []) {
    const a: Action = { type: 'useAbility', source: slot.id, ability: ab.name }
    items.push({ key: actionKey(a), label: `Ability: ${ab.name}`, text: ab.text, action: keys.has(actionKey(a)) ? a : undefined })
  }
  let hint: string | undefined
  if (found.active) {
    const cost = retreatCost(v.ctx, slot)
    hint = targets.size
      ? `Retreat (cost ${cost}): drag it onto a highlighted Benched Pokémon, or click one.`
      : `Retreat cost ${cost}${s.players[found.player].bench.length ? '; it can’t retreat right now.' : '.'}`
  }
  return { rect, title: slotName(v.ctx, slot), items, hint }
}

/** A choice between the several actions one drop or click can mean. */
export function choicePop(v: GameView, actions: Action[], rect: Rect, title: string): Pop {
  return { rect, title, items: actions.map(a => item(a, actionLabel(v.state, a))) }
}
