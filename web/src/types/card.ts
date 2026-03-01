export interface CardBrief {
  id: string
  name: string
  setId: string
  setName: string
  number: string
  image?: string
}

export interface Card extends CardBrief {
  types?: string[]
  hp?: number
  rarity?: string
  stage?: string
}
