import { useState, useEffect, useCallback } from 'react'
import { decksApi } from '@/api/decks'
import type { DeckSummary } from '@/types/deck'

export function useDecks() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await decksApi.list()
      setDecks(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createDeck = useCallback(async (name: string) => {
    const deck = await decksApi.create(name)
    setDecks(prev => [deck, ...prev])
    return deck
  }, [])

  const deleteDeck = useCallback(async (id: string) => {
    await decksApi.delete(id)
    setDecks(prev => prev.filter(d => d.id !== id))
  }, [])

  return { decks, loading, error, reload: load, createDeck, deleteDeck }
}
