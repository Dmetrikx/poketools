// What a card definition can declare. The engine collects these from every
// card in play (and from timed markers and built-in rules) and consults them
// at fixed points; card files in web/src/game/cards build them with the
// effect package (web/src/game/effects).

import type { CatalogAttack, EnergyType, WeaknessResistance } from '../catalog/types'
import type { EnergyUnit } from './rules'
import type { Ctx, Marker, PlayerId, Proc, Slot } from './types'

/** Where a modifier or handler comes from. */
export interface Source {
  kind: 'ability' | 'tool' | 'stadium' | 'energy' | 'marker' | 'rule'
  /** The player who controls it: the card's owner, or the marker's creator. */
  player: PlayerId
  /** The Pokémon it is on (abilities, tools, energy, Pokémon markers). */
  slot: Slot | null
  /** The card providing it, null for markers and rules. */
  uid: number | null
  /** Ability name, for ability sources. */
  ability?: string
  marker?: Marker
}

/** The context an effect runs in: whose it is and what it came from. */
export interface X extends Ctx {
  me: PlayerId
  opp: PlayerId
  /** The Pokémon using the attack or ability, or the one the card is attached to. */
  self: Slot | null
  /** The card the effect is printed on. */
  card: number | null
  effect: 'attack' | 'ability' | 'trainer' | 'tool' | 'stadium' | 'energy' | 'marker' | 'rule'
  /** Set by an effect to end the turn once it finishes (Lumiose City). */
  endsTurn?: boolean
}

export interface AttackX extends X {
  self: Slot
  attacker: Slot
  /** The opponent's Active Pokémon when the attack started. */
  defender: Slot | null
  attack: CatalogAttack
  /** Printed damage number. */
  base: number
  /** Opponent Pokémon this attack has damaged so far, for "damaged by an attack" triggers. */
  hits: { target: Slot; damage: number }[]
}

// ── damage ───────────────────────────────────────────────────────────────

export interface DamageEvent {
  attacker: Slot
  target: Slot
  /** Is the target the opponent's Active Pokémon? */
  toActive: boolean
  attack: CatalogAttack
  /** This attack's damage options. */
  ignoreWeakness?: boolean
  ignoreResistance?: boolean
  /** Ignore effects on the target (its abilities, attachments, markers). */
  ignoreDefenderEffects?: boolean
}

export interface KnockOutEvent {
  slot: Slot
  owner: PlayerId
  byAttack: boolean
  /** The attacking Pokémon's owner when knocked out by an attack. */
  attackerOwner: PlayerId | null
}

/** How a non-damage effect reaches a Pokémon, for prevention checks. */
export interface EffectReach {
  from: X['effect']
  /** Player whose card is producing the effect. */
  by: PlayerId
  target: Slot
  /** Damage counters (Battle Cage) or any other effect. */
  what: 'counters' | 'effect'
}

// ── modifiers ────────────────────────────────────────────────────────────

/**
 * Continuous effects. Every hook is optional and receives its source; the
 * engine combines all of them where the comment says how.
 */
export interface Modifier {
  /** Added to max HP. */
  hp?(src: Source, ctx: Ctx, slot: Slot): number
  /** Added to the Retreat Cost; 'none' sets it to 0 after every addition. */
  retreatCost?(src: Source, ctx: Ctx, slot: Slot): number | 'none'
  /** Rewrites an attack's cost (applied in source order). */
  attackCost?(src: Source, ctx: Ctx, slot: Slot, attack: CatalogAttack, cost: EnergyType[]): EnergyType[]
  /** Rewrites what one attached Energy provides. */
  energy?(src: Source, ctx: Ctx, slot: Slot, uid: number, alts: EnergyUnit[][]): EnergyUnit[][]
  /** Extra attacks a Pokémon can use (Mew ex): card id + attack name. */
  extraAttacks?(src: Source, ctx: Ctx, slot: Slot): { cardId: string; attack: string }[]
  /** Added to attack damage before Weakness and Resistance. */
  damageDealt?(src: Source, ctx: Ctx, ev: DamageEvent): number
  /** Subtracted from attack damage after Weakness and Resistance. */
  damageTaken?(src: Source, ctx: Ctx, ev: DamageEvent): number
  /** Prevent all damage from this attack to this target. */
  preventDamage?(src: Source, ctx: Ctx, ev: DamageEvent): boolean
  /** Prevent a non-damage effect reaching this Pokémon. */
  preventEffect?(src: Source, ctx: Ctx, reach: EffectReach): boolean
  /** The target would be Knocked Out by this damage: return true to survive at 10 HP. May act (discard itself). */
  survive?(src: Source, ctx: Ctx, ev: DamageEvent, before: number): boolean
  /** Added to the Prize cards taken for a Knock Out. */
  prizes?(src: Source, ctx: Ctx, ko: KnockOutEvent): number
  /** Rewrites a Pokémon's Weakness. */
  weakness?(src: Source, ctx: Ctx, slot: Slot, w: WeaknessResistance | null): WeaknessResistance | null
  /** Largest Bench this player may have (the biggest answer wins). */
  benchSize?(src: Source, ctx: Ctx, player: PlayerId): number | undefined
  /** This Pokémon has no Abilities (or not this one). */
  noAbilities?(src: Source, ctx: Ctx, slot: Slot, ability: string): boolean
  /** Tools attached to this Pokémon have no effect. */
  noTools?(src: Source, ctx: Ctx, slot: Slot): boolean
  /** False forbids playing this card from hand. */
  canPlay?(src: Source, ctx: Ctx, player: PlayerId, uid: number): boolean
  /** False forbids this attack. */
  canAttack?(src: Source, ctx: Ctx, slot: Slot, attack: CatalogAttack): boolean
  canRetreat?(src: Source, ctx: Ctx, slot: Slot): boolean
  canHeal?(src: Source, ctx: Ctx, slot: Slot): boolean
  /** False keeps this Special Condition off the Pokémon (and removes it). */
  canHaveCondition?(src: Source, ctx: Ctx, slot: Slot, condition: Condition): boolean
  /** False stops damage counters moving between Pokémon. */
  canMoveCounters?(src: Source, ctx: Ctx): boolean
  /** True lets this card evolve this Pokémon although the name doesn't match (Eevee ex). */
  evolvesFrom?(src: Source, ctx: Ctx, slot: Slot, uid: number): boolean
  /** True lets this Pokémon evolve on the turn it came into play (still not on a first turn). */
  evolveSameTurn?(src: Source, ctx: Ctx, slot: Slot, uid: number): boolean
  /** Extra damage counters from Poison during Checkup. */
  poisonCounters?(src: Source, ctx: Ctx, slot: Slot): number
  /** After an attack, may this Pokémon attack again? (Festival Lead) */
  attackAgain?(src: Source, ctx: Ctx, slot: Slot, knockedOutDefender: boolean): boolean
}

export type Condition = 'asleep' | 'confused' | 'paralyzed' | 'poisoned' | 'burned'

// ── events ───────────────────────────────────────────────────────────────

export type GameEvent =
  | { type: 'playedToBench'; slot: Slot; player: PlayerId; fromHand: boolean }
  | { type: 'evolved'; slot: Slot; player: PlayerId; fromHand: boolean }
  | { type: 'attached'; slot: Slot; card: number; player: PlayerId; fromHand: boolean }
  | { type: 'damagedByAttack'; target: Slot; attacker: Slot; damage: number }
  | { type: 'discardedByAttack'; cards: number[]; attacker: Slot }
  | { type: 'attackDone'; attacker: Slot }
  | { type: 'checkup' }
  | { type: 'turnEnd'; player: PlayerId }
  | { type: 'leftPlay'; card: number }

export type EventType = GameEvent['type']
export type EventOf<T extends EventType> = Extract<GameEvent, { type: T }>

export type Handlers = {
  [T in EventType]?: (x: X, ev: EventOf<T>) => Proc | void
}

/** Anything that can carry continuous effects and event handlers. */
export interface Effectful {
  modifiers?: Modifier
  on?: Handlers
}

// ── card parts ───────────────────────────────────────────────────────────

export interface AttackImpl {
  /** Replaces the default (printed damage to the Defending Pokémon). */
  run?: (a: AttackX) => Proc
  /** Extra requirement to use the attack. */
  canUse?: (a: AttackX) => boolean
}

export interface AbilityImpl extends Effectful {
  /** An ability the player activates. */
  use?: (x: X) => Proc
  canUse?: (x: X) => boolean
  /** 'once' (default): once per turn per Pokémon. 'repeatable': as often as you like. */
  limit?: 'once' | 'repeatable'
  /** Name shared by abilities limited to one use per turn between them. */
  group?: string
  /** Used from the hand rather than in play (Talonflame ex). */
  fromHand?: boolean
  /** Requires the Pokémon to Knock itself Out (Psyduck's Damp). */
  selfKnockOut?: boolean
}

export interface TrainerImpl extends Effectful {
  /** Extra condition to play the card (costs, prizes). */
  canPlay?: (x: X) => boolean
  /** Item / Supporter effect. */
  play?: (x: X) => Proc
  /** Supporter usable on the first turn of the player going first. */
  firstTurn?: boolean
  /** Stadium: an action each player may take once during their turn. */
  action?: { canUse?: (x: X) => boolean; run: (x: X) => Proc }
  /** Tool: which Pokémon it can be attached to. */
  canAttach?: (x: X, slot: Slot) => boolean
}

export interface EnergyImpl extends Effectful {
  /** What it provides while attached to this Pokémon. Default {C}. */
  provides?: (ctx: Ctx, slot: Slot, uid: number) => EnergyUnit[][]
  canAttach?: (x: X, slot: Slot) => boolean
}

export interface CardImpl {
  attacks?: Record<string, AttackImpl | ((a: AttackX) => Proc)>
  abilities?: Record<string, AbilityImpl>
  trainer?: TrainerImpl
  energy?: EnergyImpl
}

/** Behaviour of a marker kind (an effect that lasts for a while). */
export type MarkerImpl = Effectful

/** Where the engine looks up behaviour. */
export interface Impls {
  card(cardId: string): CardImpl | undefined
  marker(kind: string): MarkerImpl | undefined
  /** Rules every game has (the Tera rule). */
  rules(): Effectful[]
}
