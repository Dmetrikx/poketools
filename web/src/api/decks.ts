import { api } from './client'
import type { Deck, DeckSummary, CardEntry } from '@/types/deck'

export const decksApi = {
  list: () => api.get<DeckSummary[]>('/decks'),

  get: (id: string) => api.get<Deck>(`/decks/${id}`),

  create: (name: string, format = 'standard') =>
    api.post<Deck>('/decks', { name, format }),

  update: (id: string, name: string, format?: string) =>
    api.put<Deck>(`/decks/${id}`, { name, format }),

  delete: (id: string) => api.delete(`/decks/${id}`),

  // Import: parse text and optionally save
  import: (
    text: string,
    opts?: { name?: string; format?: string; save?: boolean; formatter?: string },
  ) => {
    const params = new URLSearchParams()
    if (opts?.formatter) params.set('format', opts.formatter)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return api.post<Deck>(`/decks/import${qs}`, {
      text,
      name: opts?.name,
      format: opts?.format,
      save: opts?.save ?? false,
    })
  },

  // Export: get plain text
  export: (id: string, formatter: 'ptcglive' | 'limitless' = 'ptcglive') =>
    api.getText(`/decks/${id}/export?format=${formatter}`),

  // Entry management
  addEntry: (deckId: string, entry: Omit<CardEntry, 'id' | 'deckId'>) =>
    api.post<CardEntry>(`/decks/${deckId}/entries`, entry),

  updateEntry: (deckId: string, entryId: string, count: number) =>
    api.put<void>(`/decks/${deckId}/entries/${entryId}`, { count }),

  updateEntryArt: (deckId: string, entryId: string, imageUrl: string) =>
    api.put<void>(`/decks/${deckId}/entries/${entryId}/art`, { imageUrl }),

  deleteEntry: (deckId: string, entryId: string) =>
    api.delete(`/decks/${deckId}/entries/${entryId}`),
}
