export type Section = 'pokemon' | 'trainer' | 'energy'

export interface CardEntry {
  id: string
  deckId: string
  cardId: string
  name: string
  setCode: string
  number: string
  count: number
  section: Section
  position: number
  imageUrl: string
}

export interface Deck {
  id: string
  name: string
  format: string
  entries: CardEntry[]
  created_at: string
  updated_at: string
}

export interface DeckSummary {
  id: string
  name: string
  format: string
  created_at: string
  updated_at: string
}
