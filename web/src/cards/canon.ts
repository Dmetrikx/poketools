// Canonical cards for the main app: any known print of a catalog card maps to
// that card's id and an image that is guaranteed to exist. Backed by
// game/catalog/prints.json (no rules text), loaded as its own chunk.

import type { PrintsIndex } from '@/game/catalog/types'
import { normalizeName, printKey, type EntryRef } from '@/game/catalog/resolve'

export interface Canonical {
  /** Catalog id. */
  id: string
  /** The exact print's image when it has one, else the card's canonical image. */
  image: string
}

export type Canon = (entry: EntryRef) => Canonical | null

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

/**
 * Same candidate order as the simulator's resolveEntry: the print, the stored
 * TCGdex id, then the name for trainers and energy only.
 */
export function createCanon(index: PrintsIndex): Canon {
  const decode = (ref: string) => {
    const i = ref.indexOf(':')
    return index.prefixes[Number(ref.slice(0, i))] + ref.slice(i + 1)
  }
  const card = (id: string, own?: string): Canonical | null => {
    const ref = own ?? (has(index.images, id) ? index.images[id] : undefined)
    return ref ? { id, image: decode(ref) } : null
  }
  return entry => {
    const keys = [entry.setCode && entry.number ? printKey(entry.setCode, entry.number) : '', entry.cardId]
    for (const key of keys) {
      if (!key || !has(index.prints, key)) continue
      const hit = index.prints[key]
      return typeof hit === 'string' ? card(hit) : card(hit[0], hit[1])
    }
    if (entry.section === 'pokemon') return null
    const name = normalizeName(entry.name)
    return has(index.names, name) ? card(index.names[name]) : null
  }
}

let loading: Promise<Canon> | null = null

/** The catalog card and art for a deck entry, or null when it isn't in the catalog. */
export function canonical(entry: EntryRef): Promise<Canonical | null> {
  loading ??= import('@/game/catalog/prints.json').then(m => createCanon(m.default as unknown as PrintsIndex))
  return loading.then(canon => canon(entry))
}
