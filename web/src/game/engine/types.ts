import type { CatalogCard, EnergyType } from '../catalog/types'
import type { Impls } from './impl'

export type PlayerId = 0 | 1

/** One physical card. Its uid indexes `GameState.cards`. */
export interface CardRef {
  owner: PlayerId
  cardId: string
}

export type Rotation = 'asleep' | 'confused' | 'paralyzed'

/** A Pokémon in play: its evolution stack plus everything attached. */
export interface Slot {
  /** uid of the bottom card; stable for as long as the Pokémon stays in play. */
  id: number
  /** Bottom (Basic) → top (current stage). */
  stack: number[]
  energy: number[]
  tools: number[]
  /** Damage in HP (10 per damage counter). */
  damage: number
  /** Asleep, Confused and Paralyzed replace each other. */
  rotation: Rotation | null
  poisoned: boolean
  burned: boolean
  /** Turn the Pokémon was put into play. */
  enteredTurn: number
  /** Turn it last evolved, -1 if never. */
  evolvedTurn: number
  /** Last time an opponent's attack damaged it. */
  hitBy?: { turn: number; player: PlayerId; attacker: number }
}

export interface TurnFlags {
  energyAttached: boolean
  supporterPlayed: boolean
  retreated: boolean
  stadiumPlayed: boolean
}

export interface PlayerState {
  /** Index 0 is the top of the deck. */
  deck: number[]
  hand: number[]
  discard: number[]
  prizes: number[]
  active: Slot | null
  bench: Slot[]
  mulligans: number
  flags: TurnFlags
}

/**
 * An effect that lasts for a while ("during your opponent's next turn").
 * Behaviour comes from the marker kind's registered implementation; the
 * marker itself is plain data.
 */
export interface Marker {
  id: number
  kind: string
  /** Who created it. */
  player: PlayerId
  /** The Pokémon it is on, if any. */
  slot?: number
  /** Stays on when its Pokémon moves to the Bench or evolves. */
  sticky?: boolean
  /** Ends at the end of this turn number. */
  until: number
  data?: Record<string, string | number | boolean>
}

/** What happened during one turn, for "during your last turn" effects. */
export interface TurnRecord {
  turn: number
  player: PlayerId
  knockOuts: { slot: number; owner: PlayerId; cardId: string; byAttack: boolean }[]
  attacks: { slot: number; name: string }[]
  /** Slot ids moved from the Bench to the Active Spot. */
  movedToActive: number[]
  /** Names of Supporters played. */
  supporters: string[]
  /** Activated abilities used: slot id + ability name, and its group. */
  abilities: { slot: number; name: string; group?: string }[]
  stadiumUsed: boolean
}

export interface LogEntry {
  turn: number
  player: PlayerId | null
  text: string
}

export type Phase = 'setup' | 'main' | 'over'

export interface GameState {
  cards: CardRef[]
  players: [PlayerState, PlayerState]
  stadium: number | null
  /** 0 during setup, then 1, 2, … (the first player takes the odd turns). */
  turn: number
  turnPlayer: PlayerId
  firstPlayer: PlayerId
  phase: Phase
  winner: PlayerId | 'draw' | null
  /** mulberry32 state. */
  rng: number
  /** The question the current step is waiting on. */
  pendingPrompt: Prompt | null
  log: LogEntry[]
  markers: Marker[]
  nextMarkerId: number
  /** The last few turns, newest last. */
  history: TurnRecord[]
  /** Trainers being played: out of the hand, not yet in the discard pile. */
  resolving: number[]
  /** Once-per-game effects already used, e.g. "legacy:0". */
  usedOnce: string[]
}

// ── prompts ──────────────────────────────────────────────────────────────

/**
 * A choice the engine needs from a player. Answers are plain number arrays:
 *   chooseCards / choosePokemon: the picked uids / slot ids
 *   order: the cards in their new order
 *   chooseOption: [index]
 *   yesNo: [1] or [0]
 *   distribute: one count per option, summing to `total`
 */
export type Prompt =
  | { kind: 'chooseCards'; player: PlayerId; title: string; options: number[]; min: number; max: number; hidden?: boolean }
  | { kind: 'choosePokemon'; player: PlayerId; title: string; options: number[]; min: number; max: number }
  | { kind: 'chooseOption'; player: PlayerId; title: string; options: string[] }
  | { kind: 'yesNo'; player: PlayerId; title: string }
  | { kind: 'order'; player: PlayerId; title: string; cards: number[] }
  | { kind: 'distribute'; player: PlayerId; title: string; options: number[]; total: number; maxEach?: number[] }

export type Answer = number[]

/** A procedure that may ask questions: yields prompts, resumes with answers. */
export type Proc<T = void> = Generator<Prompt, T, Answer>

// ── actions ──────────────────────────────────────────────────────────────

export type JudgeOp =
  | { op: 'setDamage'; slot: number; damage: number }
  | { op: 'setCondition'; slot: number; condition: Rotation | 'poisoned' | 'burned' | 'none' }
  | { op: 'moveCard'; uid: number; to: 'hand' | 'deckTop' | 'deckBottom' | 'discard' | 'prizes' }
  | { op: 'shuffleDeck'; player: PlayerId }
  | { op: 'draw'; player: PlayerId }
  | { op: 'resetFlags'; player: PlayerId }

export type Action =
  | { type: 'start' }
  | { type: 'playBasic'; card: number }
  | { type: 'evolve'; card: number; target: number }
  | { type: 'attachEnergy'; card: number; target: number }
  | { type: 'playTrainer'; card: number; target?: number }
  /** source: the Pokémon's slot id, or the card's uid for an ability used from the hand. */
  | { type: 'useAbility'; source: number; ability: string }
  | { type: 'stadiumAction' }
  | { type: 'retreat'; to: number; discard: number[] }
  /** source: the card id the attack is printed on when it isn't the Pokémon's own (Mew ex). */
  | { type: 'attack'; attack: string; source?: string }
  | { type: 'endTurn' }
  | { type: 'concede'; player: PlayerId }
  | { type: 'judge'; judge: JudgeOp }

// ── card data ────────────────────────────────────────────────────────────

/** Card data and behaviour the engine runs against. */
export interface Db {
  card(cardId: string): CatalogCard
  impls?: Impls
}

export interface Ctx {
  s: GameState
  db: Db
}

export type { CatalogCard, EnergyType }
