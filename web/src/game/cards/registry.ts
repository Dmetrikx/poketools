import type { EffectKey } from './effectKeys'
import { abilityKey, attackKey, textKey } from './effectKeys'

/**
 * A card's behaviour, keyed by catalog id. The shape of each implementation
 * is defined by the effect package (milestone 4); the registry only needs to
 * know which effects a definition covers.
 */
export interface CardDefinition {
  attacks?: Record<string, unknown>
  abilities?: Record<string, unknown>
  /** Trainer or Special Energy behaviour. */
  text?: unknown
}

const definitions = new Map<string, CardDefinition>()

export function defineCard(cardId: string, def: CardDefinition): void {
  if (definitions.has(cardId)) throw new Error(`card ${cardId} defined twice`)
  definitions.set(cardId, def)
}

export function cardDefinition(cardId: string): CardDefinition | undefined {
  return definitions.get(cardId)
}

/** Every effect key a registered definition implements. */
export function registeredEffects(): Set<EffectKey> {
  const keys = new Set<EffectKey>()
  for (const [id, def] of definitions) {
    for (const name of Object.keys(def.attacks ?? {})) keys.add(attackKey(id, name))
    for (const name of Object.keys(def.abilities ?? {})) keys.add(abilityKey(id, name))
    if (def.text !== undefined) keys.add(textKey(id))
  }
  return keys
}
