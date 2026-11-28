import { catalog } from '@/game/db'
import { resolveEntry } from '@/game/catalog/resolve'
import { pending } from '@/game/cards/pending'
import type { CardEntry } from '@/types/deck'

export interface ResolvedDeck {
  /** Catalog id per physical card, in uid order for this player. */
  cardIds: string[]
  /** The deck entry each physical card came from. */
  entries: CardEntry[]
  /** Entries not in the catalog's card pool. */
  unsupported: CardEntry[]
  /** Card names with effects the simulator doesn't run yet. */
  pendingNames: string[]
  count: number
}

const pendingIds = new Set(Object.keys(pending).map(k => k.split('#')[0]))

export function resolveDeck(entries: CardEntry[]): ResolvedDeck {
  const out: ResolvedDeck = { cardIds: [], entries: [], unsupported: [], pendingNames: [], count: 0 }
  const names = new Set<string>()
  for (const e of [...entries].sort((a, b) => a.position - b.position)) {
    out.count += e.count
    const card = resolveEntry(catalog, e)
    if (!card) {
      out.unsupported.push(e)
      continue
    }
    if (pendingIds.has(card.id)) names.add(card.name)
    for (let i = 0; i < e.count; i++) {
      out.cardIds.push(card.id)
      out.entries.push(e)
    }
  }
  out.pendingNames = [...names].sort()
  return out
}
