import type { CardImpl, Effectful, Impls, MarkerImpl } from '../engine/impl'
import type { EffectKey } from './effectKeys'
import { abilityKey, attackKey, textKey } from './effectKeys'

// Card behaviour by catalog id, plus marker kinds and built-in rules. Card
// files call these at module load; cards/index.ts imports every card file.

export type CardDefinition = CardImpl

const definitions = new Map<string, CardDefinition>()
const markerKinds = new Map<string, MarkerImpl>()
const builtinRules: Effectful[] = []

export function defineCard(cardId: string, def: CardDefinition): void {
  if (definitions.has(cardId)) throw new Error(`card ${cardId} defined twice`)
  definitions.set(cardId, def)
}

/** The same behaviour for several prints / cards with identical text. */
export function defineCards(cardIds: string[], def: CardDefinition): void {
  for (const id of cardIds) defineCard(id, def)
}

export function defineMarker(kind: string, impl: MarkerImpl): string {
  if (markerKinds.has(kind)) throw new Error(`marker ${kind} defined twice`)
  markerKinds.set(kind, impl)
  return kind
}

export function defineRule(rule: Effectful): void {
  builtinRules.push(rule)
}

export function cardDefinition(cardId: string): CardDefinition | undefined {
  return definitions.get(cardId)
}

/** The engine's view of the registry. */
export const registryImpls: Impls = {
  card: id => definitions.get(id),
  marker: kind => markerKinds.get(kind),
  rules: () => builtinRules,
}

/** Every effect key a registered definition implements. */
export function registeredEffects(): Set<EffectKey> {
  const keys = new Set<EffectKey>()
  for (const [id, def] of definitions) {
    for (const name of Object.keys(def.attacks ?? {})) keys.add(attackKey(id, name))
    for (const name of Object.keys(def.abilities ?? {})) keys.add(abilityKey(id, name))
    if (def.trainer || def.energy) keys.add(textKey(id))
  }
  return keys
}
