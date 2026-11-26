import type { CatalogCard } from '../catalog/types'

/**
 * Identifies one piece of card text that needs code: an attack with effect
 * text, an ability, or a trainer / Special Energy's text.
 *
 *   TWM-130#attack:Phantom Dive
 *   TWM-129#ability:Recon Directive
 *   MEG-131#text
 *
 * Attacks without effect text, Basic Energy and the Tera / ex / Mega rules
 * are handled by the engine and have no key.
 */
export type EffectKey = string

export const attackKey = (cardId: string, name: string): EffectKey => `${cardId}#attack:${name}`
export const abilityKey = (cardId: string, name: string): EffectKey => `${cardId}#ability:${name}`
export const textKey = (cardId: string): EffectKey => `${cardId}#text`

/** Every effect in the catalog that needs a card definition. */
export function catalogEffects(cards: CatalogCard[]): EffectKey[] {
  const keys: EffectKey[] = []
  for (const c of cards) {
    if (c.kind === 'pokemon') {
      for (const a of c.abilities ?? []) keys.push(abilityKey(c.id, a.name))
      for (const a of c.attacks ?? []) if (a.text) keys.push(attackKey(c.id, a.name))
    } else if (c.text) {
      keys.push(textKey(c.id))
    }
  }
  return keys
}
