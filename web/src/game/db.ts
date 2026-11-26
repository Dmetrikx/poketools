// The card database the game runs against: the catalog plus every
// registered card definition. Importing it loads the catalog chunk.

import cardsJson from './catalog/cards.json'
import aliasesJson from './catalog/aliases.json'
import { registryImpls } from './cards'
import { createCatalog } from './catalog/resolve'
import type { Aliases, CatalogCard } from './catalog/types'
import type { Impls } from './engine/impl'
import type { Db } from './engine/types'

export const catalog = createCatalog(cardsJson as CatalogCard[], aliasesJson as Aliases)

export function dbFrom(cards: Iterable<CatalogCard>, impls?: Impls): Db {
  const byId = new Map<string, CatalogCard>()
  for (const c of cards) byId.set(c.id, c)
  return {
    card(id) {
      const c = byId.get(id)
      if (!c) throw new Error(`unknown card ${id}`)
      return c
    },
    impls,
  }
}

export const gameDb = dbFrom(catalog.cards.values(), registryImpls)
