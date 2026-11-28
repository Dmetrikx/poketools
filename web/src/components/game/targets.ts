import { gameDb } from '@/game/db'
import type { Action, GameState } from '@/game/engine/types'

/**
 * How the board reaches every legal action. A source is what the player
 * picks up (or clicks); a drop zone is where it goes. Actions that need no
 * target (attacks, abilities) are menu actions. Pure: no React.
 */

export type DropZone = { kind: 'slot'; id: number } | { kind: 'bench' } | { kind: 'play' } | { kind: 'stadium' }
export type Source = { kind: 'hand'; uid: number } | { kind: 'slot'; id: number }

export function zoneKey(z: DropZone): string {
  return z.kind === 'slot' ? `slot:${z.id}` : z.kind
}

export const sameSource = (a: Source | null, b: Source | null): boolean =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'hand' ? a.uid === (b as { uid: number }).uid : a.id === (b as { id: number }).id)

function add(m: Map<string, Action[]>, key: string, a: Action) {
  const list = m.get(key)
  if (list) list.push(a)
  else m.set(key, [a])
}

const isStadium = (s: GameState, uid: number) => gameDb.card(s.cards[uid].cardId).subtype === 'Stadium'
const activeId = (s: GameState) => s.players[s.turnPlayer].active?.id

/** Where this source can be dropped, and the legal actions each drop means. */
export function dropTargets(s: GameState, legal: Action[], src: Source): Map<string, Action[]> {
  const out = new Map<string, Action[]>()
  for (const a of legal) {
    if (src.kind === 'hand') {
      switch (a.type) {
        case 'playBasic':
          if (a.card === src.uid) add(out, 'bench', a)
          break
        case 'evolve':
        case 'attachEnergy':
          if (a.card === src.uid) add(out, `slot:${a.target}`, a)
          break
        case 'playTrainer':
          if (a.card !== src.uid) break
          if (a.target !== undefined) add(out, `slot:${a.target}`, a)
          else {
            if (isStadium(s, a.card)) add(out, 'stadium', a)
            add(out, 'play', a)
          }
          break
        case 'useAbility':
          // An ability used from the hand: drop the card on the mat.
          if (a.source === src.uid) add(out, 'play', a)
          break
      }
    } else if (a.type === 'retreat' && src.id === activeId(s)) {
      add(out, `slot:${a.to}`, a)
    }
  }
  return out
}

/** Actions that need no target: attacks, abilities, abilities used from the hand. */
export function menuActions(s: GameState, legal: Action[], src: Source): Action[] {
  return legal.filter(a => {
    if (a.type === 'useAbility') return a.source === (src.kind === 'hand' ? src.uid : src.id)
    if (a.type === 'attack') return src.kind === 'slot' && src.id === activeId(s)
    return false
  })
}

/** Actions with no source at all: buttons on the table. */
export function tableActions(legal: Action[]): Action[] {
  return legal.filter(a => a.type === 'endTurn' || a.type === 'stadiumAction')
}

/**
 * What a hand card's popover lists: its menu actions, plus the zone actions
 * that need no target choice (play onto the Bench, play a Trainer, play a
 * Stadium). Targeted actions are reached by clicking a highlighted Pokémon.
 */
export function popoverActions(s: GameState, legal: Action[], src: Source): Action[] {
  const zones = dropTargets(s, legal, src)
  const seen = new Set<Action>()
  const out: Action[] = []
  const push = (a: Action) => {
    if (!seen.has(a)) { seen.add(a); out.push(a) }
  }
  for (const key of ['bench', 'stadium', 'play']) for (const a of zones.get(key) ?? []) if (a.type !== 'useAbility') push(a)
  for (const a of menuActions(s, legal, src)) push(a)
  return out
}

/** Pokémon a source can target, by slot id. */
export function slotTargets(zones: Map<string, Action[]>): Set<number> {
  const out = new Set<number>()
  for (const key of zones.keys()) if (key.startsWith('slot:')) out.add(Number(key.slice(5)))
  return out
}

/** Every source the turn player can pick up. */
export function sources(s: GameState): Source[] {
  const pl = s.players[s.turnPlayer]
  return [
    ...pl.hand.map(uid => ({ kind: 'hand', uid }) as Source),
    ...(pl.active ? [pl.active, ...pl.bench] : pl.bench).map(slot => ({ kind: 'slot', id: slot.id }) as Source),
  ]
}
