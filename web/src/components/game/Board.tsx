import PlayingCard from '@/components/practice/PlayingCard'
import { gameDb } from '@/game/db'
import { maxHp } from '@/game/engine/rules'
import type { Action, PlayerId, Slot } from '@/game/engine/types'
import { actionLabel } from './labels'
import { useView } from './view'
import styles from './Game.module.css'

export type Selection = { kind: 'hand'; uid: number } | { kind: 'slot'; id: number } | null

interface CardProps {
  uid: number
  faceUp?: boolean
  onClick?: () => void
  selected?: boolean
  className?: string
}

export function GameCard({ uid, faceUp = true, onClick, selected, className }: CardProps) {
  const v = useView()
  return (
    <PlayingCard
      entry={v.entry(uid)}
      image={v.image(uid)}
      faceUp={faceUp}
      onClick={onClick}
      className={`${styles.card} ${selected ? styles.selected : ''} ${className ?? ''}`}
    />
  )
}

const ENERGY_COLOR: Record<string, string> = {
  Grass: '#3fa34d', Fire: '#e0533a', Water: '#3a8be0', Lightning: '#e8c632', Psychic: '#a35bd1',
  Fighting: '#b8743a', Darkness: '#3b3f4f', Metal: '#9aa3ad', Dragon: '#b39a3c', Colorless: '#d9d9d9',
}

function EnergyPip({ uid }: { uid: number }) {
  const v = useView()
  const c = v.card(uid)
  const type = c.energyType ?? 'Colorless'
  const special = c.subtype === 'Special'
  return (
    <span
      className={`${styles.pip} ${special ? styles.pipSpecial : ''}`}
      style={{ background: ENERGY_COLOR[type] }}
      title={c.name}
    />
  )
}

interface SlotProps {
  slot: Slot
  active?: boolean
  selected?: boolean
  onClick?: () => void
}

export function PokemonSlot({ slot, active, selected, onClick }: SlotProps) {
  const v = useView()
  const top = slot.stack[slot.stack.length - 1]
  const hp = maxHp({ s: v.state, db: gameDb }, slot)
  const conditions = [
    slot.rotation, slot.poisoned && 'poisoned', slot.burned && 'burned',
  ].filter(Boolean) as string[]
  return (
    <div className={`${styles.slot} ${active ? styles.activeSlot : ''} ${slot.rotation === 'asleep' || slot.rotation === 'paralyzed' ? styles.rotated : ''}`}>
      <GameCard uid={top} onClick={onClick} selected={selected} />
      {slot.stack.length > 1 && <span className={styles.stackCount} title="Evolution stack">{slot.stack.length}</span>}
      {slot.damage > 0 && <span className={styles.damage} title={`${hp - slot.damage} HP left`}>{slot.damage}</span>}
      <div className={styles.slotInfo}>
        <span className={styles.hp}>{Math.max(0, hp - slot.damage)}/{hp}</span>
        <span className={styles.pips}>{slot.energy.map(uid => <EnergyPip key={uid} uid={uid} />)}</span>
      </div>
      {slot.tools.map(uid => <span key={uid} className={styles.tool}>{v.card(uid).name}</span>)}
      {conditions.length > 0 && <span className={styles.conditions}>{conditions.join(' · ')}</span>}
    </div>
  )
}

interface SideProps {
  player: PlayerId
  top?: boolean
  handFaceUp: boolean
  selection: Selection
  onSelect: (s: Selection) => void
  onZone: (player: PlayerId, zone: 'discard' | 'deck') => void
}

export function PlayerSide({ player, top, handFaceUp, selection, onSelect, onZone }: SideProps) {
  const v = useView()
  const pl = v.state.players[player]
  const isTurn = v.state.turnPlayer === player && v.state.phase === 'main'
  const pick = (s: Selection) => onSelect(isTurn ? s : null)
  const sel = (s: Selection) =>
    !!selection && !!s && selection.kind === s.kind && (selection.kind === 'hand' ? selection.uid === (s as { uid: number }).uid : selection.id === (s as { id: number }).id)

  const hand = (
    <div className={styles.hand}>
      {pl.hand.map(uid => (
        <GameCard
          key={uid}
          uid={uid}
          faceUp={handFaceUp}
          selected={sel({ kind: 'hand', uid })}
          onClick={handFaceUp ? () => pick({ kind: 'hand', uid }) : undefined}
          className={handFaceUp ? styles.handCard : styles.handBack}
        />
      ))}
      {pl.hand.length === 0 && <span className={styles.muted}>No cards in hand</span>}
    </div>
  )

  const field = (
    <div className={`${styles.field} ${top ? styles.fieldTop : ''}`}>
      <div className={styles.prizes} title={`${pl.prizes.length} Prize cards left`}>
        {pl.prizes.map(uid => <GameCard key={uid} uid={uid} faceUp={false} className={styles.prizeCard} />)}
        <span className={styles.prizeCount}>{pl.prizes.length}</span>
      </div>
      <div className={styles.inPlay}>
        <div className={styles.activeRow}>
          {pl.active
            ? <PokemonSlot slot={pl.active} active selected={sel({ kind: 'slot', id: pl.active.id })} onClick={() => pick({ kind: 'slot', id: pl.active!.id })} />
            : <div className={styles.emptyActive}>No Active Pokémon</div>}
        </div>
        <div className={styles.bench}>
          {pl.bench.map(b => (
            <PokemonSlot key={b.id} slot={b} selected={sel({ kind: 'slot', id: b.id })} onClick={() => pick({ kind: 'slot', id: b.id })} />
          ))}
        </div>
      </div>
      <div className={styles.piles}>
        <button className={styles.pile} onClick={() => onZone(player, 'deck')}>Deck<strong>{pl.deck.length}</strong></button>
        <button className={styles.pile} onClick={() => onZone(player, 'discard')}>Discard<strong>{pl.discard.length}</strong></button>
      </div>
    </div>
  )

  return (
    <section className={`${styles.side} ${isTurn ? styles.turnSide : ''}`}>
      <header className={styles.sideHeader}>
        <span>{v.names[player]}</span>
        {isTurn && <span className={styles.turnBadge}>Turn {v.state.turn}</span>}
      </header>
      {top ? <>{hand}{field}</> : <>{field}{hand}</>}
    </section>
  )
}

interface MenuProps {
  actions: Action[]
  onAct: (a: Action) => void
  onClose: () => void
  title: string
}

/** The legal actions for the selected card. */
export function ActionMenu({ actions, onAct, onClose, title }: MenuProps) {
  const v = useView()
  return (
    <div className={styles.menu} role="menu">
      <div className={styles.menuTitle}>
        <span>{title}</span>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close">×</button>
      </div>
      {actions.length === 0 && <p className={styles.muted}>Nothing to do with this card right now.</p>}
      {actions.map((a, i) => (
        <button key={i} className={styles.menuItem} onClick={() => onAct(a)}>{actionLabel(v.state, a)}</button>
      ))}
    </div>
  )
}
