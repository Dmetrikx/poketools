import type { GameState, PlayerId, Slot } from '@/game/engine/types'

/**
 * What changed between two states, for the board's animations. Pure: the
 * React side turns this into flying cards, damage numbers and banners.
 */

export type Zone = 'deck' | 'hand' | 'discard' | 'prizes' | 'active' | 'bench' | 'stadium' | 'resolving' | 'attached'

export interface Place {
  zone: Zone
  player: PlayerId
  /** The Pokémon a card is part of or attached to. */
  slot?: number
}

/** Where every card is. */
export function locate(s: GameState): Map<number, Place> {
  const out = new Map<number, Place>()
  for (const player of [0, 1] as PlayerId[]) {
    const pl = s.players[player]
    for (const zone of ['deck', 'hand', 'discard', 'prizes'] as const) {
      for (const uid of pl[zone]) out.set(uid, { zone, player })
    }
    const put = (slot: Slot, zone: 'active' | 'bench') => {
      for (const uid of slot.stack) out.set(uid, { zone, player, slot: slot.id })
      for (const uid of [...slot.energy, ...slot.tools]) out.set(uid, { zone: 'attached', player, slot: slot.id })
    }
    if (pl.active) put(pl.active, 'active')
    for (const b of pl.bench) put(b, 'bench')
  }
  if (s.stadium !== null) out.set(s.stadium, { zone: 'stadium', player: s.cards[s.stadium].owner })
  for (const uid of s.resolving) out.set(uid, { zone: 'resolving', player: s.cards[uid].owner })
  return out
}

const samePlace = (a: Place, b: Place) => a.zone === b.zone && a.player === b.player && a.slot === b.slot

export interface Change {
  moves: { uid: number; from: Place; to: Place }[]
  /** + damage, − healing, per Pokémon still in play. */
  damage: { slot: number; delta: number }[]
  /** Pokémon Knocked Out since `prev`. */
  knockedOut: number[]
  /** The Pokémon that attacked, if one did. */
  attacked: number | null
  /** New coin flips, in order (true = heads). */
  coins: boolean[]
  turnStarted: boolean
  winner: GameState['winner']
}

function slots(s: GameState): Map<number, Slot> {
  const out = new Map<number, Slot>()
  for (const pl of s.players) for (const slot of pl.active ? [pl.active, ...pl.bench] : pl.bench) out.set(slot.id, slot)
  return out
}

const koKeys = (s: GameState) => new Set(s.history.flatMap(r => r.knockOuts.map(k => `${r.turn}:${k.slot}`)))
const attackCount = (s: GameState, turn: number) => s.history.find(r => r.turn === turn)?.attacks.length ?? 0

/** `next` must follow `prev` by input (an action or an answer), not by undo. */
export function diff(prev: GameState, next: GameState): Change {
  const before = locate(prev)
  const moves: Change['moves'] = []
  for (const [uid, to] of locate(next)) {
    const from = before.get(uid)
    if (from && !samePlace(from, to)) moves.push({ uid, from, to })
  }

  const was = slots(prev)
  const damage: Change['damage'] = []
  for (const [id, slot] of slots(next)) {
    const old = was.get(id)
    if (old && old.damage !== slot.damage) damage.push({ slot: id, delta: slot.damage - old.damage })
  }

  const oldKos = koKeys(prev)
  const knockedOut = next.history
    .flatMap(r => r.knockOuts.filter(k => !oldKos.has(`${r.turn}:${k.slot}`)).map(k => k.slot))

  // An attack usually ends the turn in the same step, so look at every turn kept.
  let attacked: number | null = null
  for (const r of next.history) {
    if (r.attacks.length > attackCount(prev, r.turn)) attacked = r.attacks[r.attacks.length - 1].slot
  }

  return {
    moves,
    damage,
    knockedOut,
    attacked,
    coins: next.coins.slice(prev.coins.length),
    turnStarted: next.phase === 'main' && next.turn > prev.turn,
    winner: next.winner !== prev.winner ? next.winner : null,
  }
}

export const isEmpty = (c: Change) =>
  !c.moves.length && !c.damage.length && !c.knockedOut.length && c.attacked === null && !c.coins.length && !c.turnStarted && c.winner === null
