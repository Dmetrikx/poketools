import { useState, useEffect, useRef } from 'react'
import { cardsApi } from '@/api/cards'
import { cardImageUrl } from '@/hooks/useCardImages'
import type { CardEntry } from '@/types/deck'
import styles from './DeckThumbnail.module.css'

interface Props {
  entries: CardEntry[]
}

const stagePriority: Record<string, number> = {
  'Stage 2': 3,
  'VMAX': 3,
  'Stage 1': 2,
  'VSTAR': 2,
  'Basic': 1,
}

interface ResolvedCard {
  name: string
  stage: number
  count: number
  image: string
}

export default function DeckThumbnail({ entries }: Props) {
  const [cards, setCards] = useState<ResolvedCard[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  const pokemonEntries = entries.filter(e => e.section === 'pokemon')

  // Stable dep key for the effect
  const depsKey = pokemonEntries
    .map(e => `${e.name}:${e.setCode}:${e.count}`)
    .sort()
    .join('\x00')

  useEffect(() => {
    if (pokemonEntries.length === 0) {
      setLoading(false)
      return
    }

    // Prevent double-fetch in strict mode
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false

    async function resolve() {
      const results: ResolvedCard[] = []

      // Deduplicate by name (keep highest count)
      const byName = new Map<string, CardEntry>()
      for (const entry of pokemonEntries) {
        const existing = byName.get(entry.name)
        if (!existing || entry.count > existing.count) {
          byName.set(entry.name, entry)
        }
      }

      const unique = Array.from(byName.values())

      await Promise.all(
        unique.map(async (entry) => {
          try {
            // Try search with set first
            let searchResults = entry.setCode
              ? await cardsApi.search(entry.name, entry.setCode)
              : []

            // Fallback to name-only search
            if (searchResults.length === 0) {
              searchResults = await cardsApi.search(entry.name)
            }

            const match = searchResults.find(
              r => r.name.toLowerCase() === entry.name.toLowerCase()
            ) ?? searchResults[0]

            if (!match?.image) return

            // Fetch full card detail for stage info
            let stage = 1
            try {
              const detail = await cardsApi.get(match.id)
              stage = stagePriority[detail.stage ?? ''] ?? 1
            } catch {
              // Use default priority if detail fetch fails
            }

            results.push({
              name: entry.name,
              stage,
              count: entry.count,
              image: cardImageUrl(match.image, 'low'),
            })
          } catch {
            // Skip cards that fail to resolve
          }
        })
      )

      if (cancelled) return

      // Sort: stage desc, then count desc
      results.sort((a, b) => b.stage - a.stage || b.count - a.count)

      setCards(results.slice(0, 4))
      setLoading(false)
    }

    resolve()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])

  if (pokemonEntries.length === 0) return null

  if (loading) {
    return (
      <div className={styles.grid}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={styles.placeholder} />
        ))}
      </div>
    )
  }

  if (cards.length === 0) return null

  return (
    <div className={styles.grid}>
      {cards.map((card, i) => (
        <img
          key={i}
          src={card.image}
          alt={card.name}
          className={styles.cardImg}
          loading="lazy"
        />
      ))}
    </div>
  )
}
