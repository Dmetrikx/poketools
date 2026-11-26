import type { GameEvent, Source, X } from './impl'
import { handlersFor } from './modifiers'
import type { Ctx, PlayerId, Proc } from './types'

const otherPlayer = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0)

/** The context an effect from this source runs in. */
export function xFor(ctx: Ctx, src: Source): X {
  const effect = src.kind
  return { s: ctx.s, db: ctx.db, me: src.player, opp: otherPlayer(src.player), self: src.slot, card: src.uid, effect }
}

/** Runs every handler for the event, the turn player's first. */
export function* emit(ctx: Ctx, ev: GameEvent): Proc {
  for (const { src, fn } of handlersFor(ctx, ev.type)) {
    const r = (fn as (x: X, ev: GameEvent) => Proc | void)(xFor(ctx, src), ev)
    if (r) yield* r
  }
}
