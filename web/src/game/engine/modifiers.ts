import type { AbilityImpl, CardImpl, Effectful, EventType, Handlers, Modifier, Source } from './impl'
import type { Ctx, PlayerId, Slot } from './types'

// Collects continuous effects from everything in play: built-in rules, the
// Stadium, timed markers, and each Pokémon's abilities, Tools and Special
// Energy. Ability and Tool locks are resolved first, in two stages:
//   1. rules, the Stadium and markers always apply;
//   2. abilities that lock abilities apply unless stage 1 switched them off.
// So a Stadium can switch off a locking ability, but two locking abilities
// don't switch each other off (each card's "except" clause handles itself).

export interface Bound {
  src: Source
  fx: Effectful
}

export function cardImpl(ctx: Ctx, cardId: string): CardImpl | undefined {
  return ctx.db.impls?.card(cardId)
}

export function implOf(ctx: Ctx, uid: number): CardImpl | undefined {
  return cardImpl(ctx, ctx.s.cards[uid].cardId)
}

export function abilityImpl(ctx: Ctx, cardId: string, name: string): AbilityImpl | undefined {
  return cardImpl(ctx, cardId)?.abilities?.[name]
}

const topUid = (slot: Slot) => slot.stack[slot.stack.length - 1]

function slotsOf(ctx: Ctx): { slot: Slot; player: PlayerId }[] {
  const out: { slot: Slot; player: PlayerId }[] = []
  for (const p of [0, 1] as PlayerId[]) {
    const pl = ctx.s.players[p]
    if (pl.active) out.push({ slot: pl.active, player: p })
    for (const b of pl.bench) out.push({ slot: b, player: p })
  }
  return out
}

/** Rules, the Stadium and markers: the sources no lock can switch off. */
function fixedSources(ctx: Ctx): Bound[] {
  const s = ctx.s
  const out: Bound[] = []
  for (const fx of ctx.db.impls?.rules() ?? []) out.push({ src: { kind: 'rule', player: s.turnPlayer, slot: null, uid: null }, fx })
  if (s.stadium !== null) {
    const fx = implOf(ctx, s.stadium)?.trainer
    if (fx) out.push({ src: { kind: 'stadium', player: s.cards[s.stadium].owner, slot: null, uid: s.stadium }, fx })
  }
  for (const m of s.markers) {
    const fx = ctx.db.impls?.marker(m.kind)
    if (!fx) continue
    const slot = m.slot === undefined ? null : findSlotById(ctx, m.slot)
    if (m.slot !== undefined && !slot) continue
    out.push({ src: { kind: 'marker', player: m.player, slot, uid: null, marker: m }, fx })
  }
  return out
}

function findSlotById(ctx: Ctx, id: number): Slot | null {
  return slotsOf(ctx).find(x => x.slot.id === id)?.slot ?? null
}

function abilitySources(ctx: Ctx, slot: Slot, player: PlayerId): Bound[] {
  const uid = topUid(slot)
  const card = ctx.db.card(ctx.s.cards[uid].cardId)
  const abilities = cardImpl(ctx, card.id)?.abilities ?? {}
  return (card.abilities ?? [])
    .filter(a => abilities[a.name])
    .map(a => ({ src: { kind: 'ability' as const, player, slot, uid, ability: a.name }, fx: abilities[a.name] }))
}

function locked(ctx: Ctx, lockers: Bound[], slot: Slot, ability: string): boolean {
  return lockers.some(b => b.fx.modifiers?.noAbilities?.(b.src, ctx, slot, ability))
}

/** Does this Pokémon's ability currently do nothing? */
export function abilityOff(ctx: Ctx, slot: Slot, ability: string): boolean {
  const fixed = fixedSources(ctx).filter(b => b.fx.modifiers?.noAbilities)
  if (locked(ctx, fixed, slot, ability)) return true
  const lockers: Bound[] = []
  for (const { slot: other, player } of slotsOf(ctx)) {
    for (const b of abilitySources(ctx, other, player)) {
      if (b.fx.modifiers?.noAbilities && !locked(ctx, fixed, other, b.src.ability!)) lockers.push(b)
    }
  }
  return locked(ctx, lockers, slot, ability)
}

/** Do the Tools on this Pokémon currently do nothing? */
export function toolsOff(ctx: Ctx, slot: Slot): boolean {
  return fixedSources(ctx).some(b => b.fx.modifiers?.noTools?.(b.src, ctx, slot))
}

/** Every active source of continuous effects and handlers. */
export function sources(ctx: Ctx): Bound[] {
  const out = fixedSources(ctx)
  for (const { slot, player } of slotsOf(ctx)) {
    for (const b of abilitySources(ctx, slot, player)) if (!abilityOff(ctx, slot, b.src.ability!)) out.push(b)
    if (!toolsOff(ctx, slot)) {
      for (const uid of slot.tools) {
        const fx = implOf(ctx, uid)?.trainer
        if (fx) out.push({ src: { kind: 'tool', player, slot, uid }, fx })
      }
    }
    for (const uid of slot.energy) {
      const fx = implOf(ctx, uid)?.energy
      if (fx) out.push({ src: { kind: 'energy', player, slot, uid }, fx })
    }
  }
  return out
}

type Hook<K extends keyof Modifier> = NonNullable<Modifier[K]>

/** Each active modifier implementing this hook, with its source. */
export function each<K extends keyof Modifier>(ctx: Ctx, key: K, skipSlot?: Slot): [Source, Hook<K>][] {
  const out: [Source, Hook<K>][] = []
  for (const b of sources(ctx)) {
    const f = b.fx.modifiers?.[key]
    if (!f) continue
    if (skipSlot && b.src.slot?.id === skipSlot.id) continue
    out.push([b.src, f as Hook<K>])
  }
  return out
}

/** False if any modifier forbids it. */
export function allowed<K extends keyof Modifier>(ctx: Ctx, key: K, ...args: unknown[]): boolean {
  for (const [src, f] of each(ctx, key)) {
    if ((f as (...a: unknown[]) => boolean)(src, ctx, ...args) === false) return false
  }
  return true
}

/** Handlers for an event, the turn player's first. */
export function handlersFor(ctx: Ctx, type: EventType): { src: Source; fn: NonNullable<Handlers[EventType]> }[] {
  const out: { src: Source; fn: NonNullable<Handlers[EventType]> }[] = []
  for (const b of sources(ctx)) {
    const fn = b.fx.on?.[type]
    if (fn) out.push({ src: b.src, fn: fn as NonNullable<Handlers[EventType]> })
  }
  const tp = ctx.s.turnPlayer
  return out.sort((a, b) => Number(a.src.player !== tp) - Number(b.src.player !== tp))
}
