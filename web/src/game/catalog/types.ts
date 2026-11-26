// Shapes of the generated card catalog (cards.json / aliases.json).
// Written by web/scripts/build-catalog.ts; never edit the JSON by hand.

export type EnergyType =
  | 'Grass' | 'Fire' | 'Water' | 'Lightning' | 'Psychic' | 'Fighting'
  | 'Darkness' | 'Metal' | 'Dragon' | 'Fairy' | 'Colorless'

export type CardKind = 'pokemon' | 'trainer' | 'energy'

export type PokemonStage = 'Basic' | 'Stage 1' | 'Stage 2'
export type TrainerSubtype = 'Supporter' | 'Item' | 'Tool' | 'Stadium'
export type EnergySubtype = 'Basic' | 'Special'

export interface CatalogAttack {
  name: string
  cost: EnergyType[]
  /** As printed: "200", "30+", "50×", "" for no damage. */
  damage: string
  /** Effect text, "" for a plain damage attack. */
  text: string
}

export interface CatalogAbility {
  name: string
  text: string
}

export interface WeaknessResistance {
  type: EnergyType
  /** "×2", "-30" */
  value: string
}

export interface CatalogCard {
  /** Limitless `SET-number` of the print the pool uses most, e.g. "TWM-130". */
  id: string
  name: string
  kind: CardKind
  /** Pokémon: stage. Trainer: Supporter/Item/Tool/Stadium. Energy: Basic/Special. */
  subtype: PokemonStage | TrainerSubtype | EnergySubtype
  hp?: number
  types?: EnergyType[]
  evolveFrom?: string
  attacks?: CatalogAttack[]
  abilities?: CatalogAbility[]
  /** Printed rule boxes other than the ex/Mega prize rule, e.g. the Tera rule. */
  rules?: string[]
  weakness?: WeaknessResistance | null
  resistance?: WeaknessResistance | null
  retreat?: number
  /** Trainer / Special Energy effect text. */
  text?: string
  /** Basic Energy: the type it provides. */
  energyType?: EnergyType
  /** "ex", "Mega", "Tera", "ACE SPEC", "Ancient", "Future", owner prefix like "N's". */
  tags: string[]
  regulationMark?: string
  tcgdexId?: string
  /** Every `SET-number` print with this card's text. */
  prints: string[]
  /** Number of LAIC lists that played the card. */
  lists: number
}

/** `SET-number` (Limitless / PTCG Live) and TCGdex card ids → catalog id. */
export type Aliases = Record<string, string>

export interface FixtureCard {
  count: number
  name: string
  set: string
  number: string
  kind: CardKind
}

export interface FixtureDeck {
  archetype: string
  placing: number
  cards: FixtureCard[]
}
