import { useState, useEffect, useCallback, useRef } from 'react'
import { resolveCard } from '@/api/cards'
import { imageKey } from '@/hooks/useCardImages'
import type { CardEntry } from '@/types/deck'

// Stages from TCGdex that are definitively not basic Pokémon.
// Unknown/empty stage is treated as potentially basic (graceful degradation).
export const EVOLVED_STAGES = new Set(['Stage1', 'Stage2', 'MEGA', 'BREAK'])

function loadOverrides(key: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function saveOverrides(key: string, basics: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...basics]))
  } catch {
    // Storage unavailable: overrides last for this session only
  }
}

/**
 * Works out which Pokémon in a deck are basic, for mulligan checks.
 * Stages come from TCGdex; the user can override them, and the overrides are
 * kept in localStorage per deck. `ready` turns true once the initial set is known.
 */
export function useBasicPokemon(deckId: string, entries: CardEntry[]) {
  const overridesKey = `practice-overrides-${deckId}`

  const [stageMap, setStageMap] = useState<Record<string, string>>({})
  const [basicOverrides, setBasicOverrides] = useState<Set<string>>(() => loadOverrides(overridesKey) ?? new Set())
  const [ready, setReady] = useState(false)
  const hadSavedOverrides = useRef(loadOverrides(overridesKey) !== null)

  // Fetch stage data then initialise basicOverrides from it.
  useEffect(() => {
    const pokemonEntries = entries.filter(e => e.section === 'pokemon')
    if (pokemonEntries.length === 0) {
      setReady(true)
      return
    }

    let cancelled = false
    const fetchStages = async () => {
      const stages: Record<string, string> = {}
      // Deduplicate by imageKey — same key used everywhere for consistency
      const seen = new Set<string>()
      const unique = pokemonEntries.filter(e => {
        const k = imageKey(e)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      await Promise.all(
        unique.map(async entry => {
          const k = imageKey(entry)
          try {
            const card = await resolveCard(entry)
            if (card) stages[k] = card.stage ?? ''
          } catch {
            // Silently skip — unknown stage → treated as basic
          }
        })
      )
      if (cancelled) return

      setStageMap(stages)

      // Only seed overrides from stage data if no saved overrides exist
      if (!hadSavedOverrides.current) {
        const initialBasics = new Set(
          pokemonEntries
            .filter(e => !EVOLVED_STAGES.has(stages[imageKey(e)]))
            .map(e => imageKey(e))
        )
        setBasicOverrides(initialBasics)
        saveOverrides(overridesKey, initialBasics)
      }
      setReady(true)
    }

    fetchStages()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, entries.length])

  const toggleBasic = useCallback((key: string) => {
    setBasicOverrides(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveOverrides(overridesKey, next)
      return next
    })
  }, [overridesKey])

  return { stageMap, basicOverrides, toggleBasic, ready }
}
