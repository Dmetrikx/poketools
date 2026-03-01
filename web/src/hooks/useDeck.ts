import { useState, useEffect, useCallback } from 'react'
import { decksApi } from '@/api/decks'
import type { Deck, CardEntry } from '@/types/deck'

export function useDeck(id: string) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await decksApi.get(id)
      setDeck(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const addEntry = useCallback(async (entry: Omit<CardEntry, 'id' | 'deckId'>) => {
    const created = await decksApi.addEntry(id, entry)
    setDeck(prev => prev ? { ...prev, entries: [...(prev.entries ?? []), created] } : prev)
    return created
  }, [id])

  const updateEntry = useCallback(async (entryId: string, count: number) => {
    await decksApi.updateEntry(id, entryId, count)
    setDeck(prev => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map(e => e.id === entryId ? { ...e, count } : e),
      }
    })
  }, [id])

  const deleteEntry = useCallback(async (entryId: string) => {
    await decksApi.deleteEntry(id, entryId)
    setDeck(prev => {
      if (!prev) return prev
      return { ...prev, entries: prev.entries.filter(e => e.id !== entryId) }
    })
  }, [id])

  const updateEntryArt = useCallback(async (entryId: string, imageUrl: string) => {
    await decksApi.updateEntryArt(id, entryId, imageUrl)
    setDeck(prev => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map(e => e.id === entryId ? { ...e, imageUrl } : e),
      }
    })
  }, [id])

  const exportDeck = useCallback(
    (formatter: 'ptcglive' | 'limitless' = 'ptcglive') => decksApi.export(id, formatter),
    [id],
  )

  return { deck, loading, error, reload: load, addEntry, updateEntry, updateEntryArt, deleteEntry, exportDeck }
}
