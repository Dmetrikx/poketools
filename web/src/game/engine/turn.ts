import { ask } from './prompt'
import { coin } from './rng'
import {
  HAND_SIZE, PRIZES, benchLimit, cardOf, clearConditions, discardSlot, draw, inPlay, isBasicPokemon,
  log, maxHp, newSlot, other, prizeValue, shuffleDeck, slotName, slotOwner, takeFromZone,
} from './rules'
import type { Ctx, PlayerId, Proc, Slot } from './types'

const MAX_MULLIGANS = 100

// ── setup ────────────────────────────────────────────────────────────────

export function* setup(ctx: Ctx): Proc {
  const s = ctx.s
  for (const p of [0, 1] as PlayerId[]) {
    if (!s.players[p].deck.some(uid => isBasicPokemon(cardOf(ctx, uid)))) {
      log(ctx, p, 'Deck has no Basic Pokémon.')
      return endGame(ctx, other(p))
    }
    shuffleDeck(ctx, p)
  }

  const winner: PlayerId = coin(s) ? 0 : 1
  log(ctx, winner, 'Won the coin flip.')
  const [first] = yield* ask({ kind: 'chooseOption', player: winner, title: 'You won the coin flip', options: ['Go first', 'Go second'] })
  s.firstPlayer = first === 0 ? winner : other(winner)
  s.turnPlayer = s.firstPlayer
  log(ctx, s.firstPlayer, 'Goes first.')

  for (const p of [0, 1] as PlayerId[]) {
    const pl = s.players[p]
    draw(ctx, p, HAND_SIZE)
    while (!pl.hand.some(uid => isBasicPokemon(cardOf(ctx, uid))) && pl.mulligans < MAX_MULLIGANS) {
      pl.mulligans++
      pl.deck.push(...pl.hand.splice(0))
      shuffleDeck(ctx, p)
      draw(ctx, p, HAND_SIZE)
    }
    if (pl.mulligans) log(ctx, p, `Mulligan ×${pl.mulligans}.`)
  }

  for (const p of [s.firstPlayer, other(s.firstPlayer)]) {
    const extra = Math.max(0, s.players[other(p)].mulligans - s.players[p].mulligans)
    if (!extra) continue
    const options = Array.from({ length: extra + 1 }, (_, i) => `Draw ${i}`)
    const [n] = yield* ask({ kind: 'chooseOption', player: p, title: 'Your opponent took mulligans: draw extra cards?', options })
    if (n) log(ctx, p, `Drew ${draw(ctx, p, n)} extra.`)
  }

  for (const p of [s.firstPlayer, other(s.firstPlayer)]) {
    const pl = s.players[p]
    const basics = () => pl.hand.filter(uid => isBasicPokemon(cardOf(ctx, uid)))
    const [active] = yield* ask({ kind: 'chooseCards', player: p, title: 'Choose your Active Pokémon', options: basics(), min: 1, max: 1 })
    takeFromZone(pl.hand, active)
    pl.active = newSlot(active, 0)
    const bench = yield* ask({ kind: 'chooseCards', player: p, title: 'Choose Benched Pokémon', options: basics(), min: 0, max: benchLimit(ctx, p) })
    for (const uid of bench) {
      takeFromZone(pl.hand, uid)
      pl.bench.push(newSlot(uid, 0))
    }
  }

  for (const p of [0, 1] as PlayerId[]) {
    const pl = s.players[p]
    pl.prizes = pl.deck.splice(0, PRIZES)
  }

  s.phase = 'main'
  s.turn = 1
  startTurn(ctx)
}

// ── turns ────────────────────────────────────────────────────────────────

export function resetFlags(ctx: Ctx, p: PlayerId): void {
  ctx.s.players[p].flags = { energyAttached: false, supporterPlayed: false, retreated: false, stadiumPlayed: false }
}

/** The turn player draws; an empty deck loses the game. */
export function startTurn(ctx: Ctx): void {
  const p = ctx.s.turnPlayer
  resetFlags(ctx, p)
  log(ctx, p, `Turn ${ctx.s.turn}.`)
  if (!draw(ctx, p, 1)) {
    log(ctx, p, 'Can\'t draw: deck is empty.')
    endGame(ctx, other(p))
  }
}

export function* endTurn(ctx: Ctx): Proc {
  yield* checkup(ctx)
  if (ctx.s.phase === 'over') return
  ctx.s.turn++
  ctx.s.turnPlayer = other(ctx.s.turnPlayer)
  startTurn(ctx)
}

/** Pokémon Checkup between turns: poison, burn, sleep, paralysis, then Knock Outs. */
export function* checkup(ctx: Ctx): Proc {
  const s = ctx.s
  const ending = s.turnPlayer
  for (const p of [ending, other(ending)]) {
    const slot = s.players[p].active
    if (!slot) continue
    const name = slotName(ctx, slot)
    if (slot.poisoned) {
      slot.damage += 10
      log(ctx, p, `${name} takes 1 damage counter from Poison.`)
    }
    if (slot.burned) {
      slot.damage += 20
      const heads = coin(s)
      log(ctx, p, `${name} takes 2 damage counters from Burn; flip ${heads ? 'heads: recovers' : 'tails: still Burned'}.`)
      if (heads) slot.burned = false
    }
    if (slot.rotation === 'asleep') {
      const heads = coin(s)
      log(ctx, p, `${name} is Asleep; flip ${heads ? 'heads: wakes up' : 'tails: stays Asleep'}.`)
      if (heads) slot.rotation = null
    }
    if (slot.rotation === 'paralyzed' && p === ending) {
      slot.rotation = null
      log(ctx, p, `${name} recovers from Paralysis.`)
    }
  }
  yield* resolveKnockOuts(ctx)
}

// ── knock outs and winning ───────────────────────────────────────────────

export function endGame(ctx: Ctx, winner: PlayerId | 'draw'): void {
  ctx.s.phase = 'over'
  ctx.s.winner = winner
  ctx.s.pendingPrompt = null
  log(ctx, winner === 'draw' ? null : winner, winner === 'draw' ? 'The game is a draw.' : 'Wins the game.')
}

/**
 * Knocks Out every Pokémon whose damage reaches its HP, gives out Prize
 * cards, checks the win conditions, and has each player promote a new
 * Active if theirs was Knocked Out.
 */
export function* resolveKnockOuts(ctx: Ctx): Proc {
  const s = ctx.s
  const knocked: Slot[] = []
  for (const p of [0, 1] as PlayerId[]) {
    for (const slot of inPlay(s.players[p])) if (slot.damage >= maxHp(ctx, slot)) knocked.push(slot)
  }
  if (!knocked.length && s.players.every(pl => pl.active)) return

  const prizesFor: [number, number] = [0, 0]
  for (const slot of knocked) {
    const owner = slotOwner(ctx, slot)
    prizesFor[other(owner)] += prizeValue(ctx, slot)
    log(ctx, owner, `${slotName(ctx, slot)} is Knocked Out.`)
    discardSlot(ctx, slot)
  }
  for (const p of [0, 1] as PlayerId[]) if (prizesFor[p]) takePrizes(ctx, p, prizesFor[p])

  if (checkWin(ctx)) return

  for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
    const pl = s.players[p]
    if (pl.active || !pl.bench.length) continue
    const [id] = yield* ask({ kind: 'choosePokemon', player: p, title: 'Choose your new Active Pokémon', options: pl.bench.map(b => b.id), min: 1, max: 1 })
    promote(ctx, p, id)
  }
}

export function promote(ctx: Ctx, p: PlayerId, benchId: number): void {
  const pl = ctx.s.players[p]
  const i = pl.bench.findIndex(b => b.id === benchId)
  pl.active = pl.bench.splice(i, 1)[0]
  clearConditions(pl.active)
  log(ctx, p, `${slotName(ctx, pl.active)} is now Active.`)
}

export function takePrizes(ctx: Ctx, p: PlayerId, n: number): void {
  const pl = ctx.s.players[p]
  const taken = pl.prizes.splice(0, Math.min(n, pl.prizes.length))
  pl.hand.push(...taken)
  log(ctx, p, `Takes ${taken.length} Prize card${taken.length === 1 ? '' : 's'}.`)
}

/** Ends the game if a player has taken every Prize or has no Pokémon in play. */
export function checkWin(ctx: Ctx): boolean {
  const s = ctx.s
  const wins = ([0, 1] as PlayerId[]).filter(p =>
    s.players[p].prizes.length === 0 || inPlay(s.players[other(p)]).length === 0)
  if (!wins.length) return false
  endGame(ctx, wins.length === 2 ? 'draw' : wins[0])
  return true
}
