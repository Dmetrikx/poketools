import { useState, useEffect } from 'react'
import { cardsApi } from '@/api/cards'
import { useDebounce } from './useDebounce'
import type { CardBrief } from '@/types/card'

export function useCardSearch(query: string, set?: string) {
  const [results, setResults] = useState<CardBrief[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 350)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    cardsApi.search(debouncedQuery, set)
      .then(data => { if (!cancelled) setResults(data ?? []) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, set])

  return { results, loading, error }
}
