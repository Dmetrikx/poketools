import { api } from './client'
import type { Card, CardBrief } from '@/types/card'

export const cardsApi = {
  search: (q: string, set?: string) => {
    const params = new URLSearchParams({ q })
    if (set) params.set('set', set)
    return api.get<CardBrief[]>(`/cards/search?${params.toString()}`)
  },

  get: (id: string) => api.get<Card>(`/cards/${id}`),
}
