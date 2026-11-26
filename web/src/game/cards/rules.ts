import type { Effectful } from '../engine/impl'
import { isActive } from '../effects/select'
import { defineRule } from './registry'

// Rules printed on many cards that the catalog keeps as tags.

/** Tera: "As long as this Pokémon is on your Bench, prevent all damage done to this Pokémon by attacks (both yours and your opponent's)." */
export const teraRule: Effectful = {
  modifiers: {
    preventDamage: (_src, ctx, ev) =>
      ctx.db.card(ctx.s.cards[ev.target.stack[ev.target.stack.length - 1]].cardId).tags.includes('Tera') && !isActive(ctx, ev.target),
  },
}

defineRule(teraRule)
