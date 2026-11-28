// Card effects in the catalog that the simulator doesn't run yet, each
// classified into the primitives it needs (taxonomy.ts). Policy: a card
// played in 5+ lists across the catalog tournaments is implemented; rarer
// cards may wait here. A deck with a pending card can still start a matchup
// (MatchupSetup lists them). Implement one, then run
// `npx vite-node scripts/prune-pending.ts` from web/.

import type { EffectKey } from './effectKeys'
import type { Primitive } from './taxonomy'

export const pending: Record<EffectKey, Primitive[]> = {
  // Accompanying Flute (1 list)
  "TWM-142#text": ["lookAtTop", "searchToBench", "shuffleDeck"],
  // Alolan Exeggutor (1 list)
  "30C-2#ability:Scale Up": ["hpBonus"],
  "30C-2#attack:Mega Drain": ["heal"],
  // Amulet of Hope (1 list)
  "SSP-162#text": ["searchDeck", "shuffleDeck", "onKnockedOut"],
  // Antique Armor Fossil (1 list)
  "PBL-72#text": ["conditionImmunity", "retreatLock"],
  // Archaludon (1 list)
  "PFL-75#attack:Coated Attack": ["preventDamage", "timedMarker"],
  // Archaludon (2 lists)
  "SCR-107#ability:Metal Bridge": ["retreatCost"],
  "SCR-107#attack:Iron Blaster": ["attackLock", "timedMarker"],
  // Archaludon ex (3 lists)
  "SSP-130#ability:Assemble Alloy": ["attachFromDiscard", "onEvolve"],
  "SSP-130#attack:Metal Defender": ["weaknessChange", "timedMarker"],
  // Armarouge (2 lists)
  "PBL-12#attack:Flame Legion": ["scaleDamage"],
  // Barbaracle (4 lists)
  "POR-43#ability:Stone Arms": ["attachFromHand", "oncePerTurn"],
  // Bastiodon (1 list)
  "PBL-62#ability:Ancient Bulwark": ["preventDamage"],
  // Beheeyem (1 list)
  "TEF-74#attack:Cosmic Beatdown": ["scaleDamage"],
  // Binacle (4 lists)
  "POR-42#attack:Double Draw": ["draw"],
  // Blaziken (2 lists)
  "DRI-42#attack:Inferno Kick Flurry": ["discardEnergy", "damage"],
  // Brute Bonnet (2 lists)
  "TWM-118#attack:Poison Spray": ["applyCondition"],
  "TWM-118#attack:Relentless Punches": ["scaleDamage"],
  // Canari (4 lists)
  "ASC-185#text": ["searchDeck", "shuffleDeck", "playCondition"],
  // Charcadet (2 lists)
  "PBL-11#attack:Best Punch": ["flip", "conditionalDamage"],
  // Cinccino ex (1 list)
  "CRI-73#ability:Smooth Coat": ["flip", "preventDamage"],
  "CRI-73#attack:Energized Slap": ["scaleDamage"],
  // Clefairy (1 list)
  "POR-30#attack:Follow Me": ["gust"],
  // Comfey (3 lists)
  "SCR-63#attack:Flower Shower": ["draw"],
  "SCR-63#attack:Play Rough": ["flip", "conditionalDamage"],
  // Counter Gain (1 list)
  "SSP-169#text": ["attackCost"],
  // Deoxys (2 lists)
  "CRI-32#attack:Psyspear": ["damage", "conditionalDamage"],
  // Dialga (1 list)
  "MEG-95#attack:Chrono Burst": ["energyToDeck", "conditionalDamage"],
  // Dipplin (1 list)
  "SCR-13#attack:Coated Attack": ["preventDamage", "timedMarker"],
  // Drayton (2 lists)
  "SSP-174#text": ["lookAtTop"],
  // Duraludon (3 lists)
  "SCR-106#attack:Raging Hammer": ["scaleDamage"],
  // Eelektrik (4 lists)
  "ASC-60#ability:Dynamotor": ["attachFromDiscard", "oncePerTurn"],
  // Eevee (1 list)
  "SCR-113#attack:Call for Family": ["searchToBench", "shuffleDeck"],
  // Eevee (2 lists)
  "SSP-143#ability:Boosted Evolution": ["evolutionRule", "activeOnly"],
  "SSP-143#attack:Reckless Charge": ["selfDamage"],
  // Electrike (4 lists)
  "MEG-49#attack:Thunder Jolt": ["selfDamage"],
  // Energy Swatter (1 list)
  "POR-73#text": ["revealHand"],
  // Espeon (1 list)
  "30C-69#attack:Miraculous Shine": ["devolve"],
  // Espeon ex (1 list)
  "30C-70#attack:Solar Beatdown": ["scaleDamage"],
  // Exeggcute (1 list)
  "30C-1#attack:Hypnosis": ["applyCondition"],
  // Fennel (1 list)
  "BLK-82#text": ["heal"],
  // Flareon ex (2 lists)
  "PRE-14#attack:Burning Charge": ["searchAttach", "shuffleDeck"],
  "PRE-14#attack:Carnelian": ["attackLock", "timedMarker"],
  // Fossil Quarry (1 list)
  "PBL-76#text": ["stadiumAction", "searchToBench", "shuffleDeck"],
  // Furfrou (1 list)
  "POR-67#attack:Hand Trim": ["discardFromHand"],
  // Galvantula (3 lists)
  "SFA-2#ability:Compound Eyes": ["damageBonus"],
  "SFA-2#attack:Shocking Web": ["conditionalDamage"],
  // Glalie (2 lists)
  "TWM-52#attack:Damage Beat": ["scaleDamage"],
  "TWM-52#attack:Crazy Headbutt": ["discardEnergy"],
  // Great Haul Net (1 list)
  "CRI-78#text": ["discardToDeck"],
  // Heatran (2 lists)
  "TWM-123#ability:Incandescent Body": ["applyCondition", "onDamagedByAttack"],
  "TWM-123#attack:Steel Burst": ["discardEnergy", "scaleDamage"],
  // Hoothoot (1 list)
  "TEF-126#attack:Silent Wing": ["revealHand"],
  // Iono's Kilowattrel (3 lists)
  "JTG-55#ability:Flashing Draw": ["discardEnergy", "drawUntil", "oncePerTurn"],
  // Iono's Wattrel (3 lists)
  "JTG-54#attack:Quick Attack": ["flip", "conditionalDamage"],
  // Joltik (4 lists)
  "SCR-50#attack:Jolting Charge": ["searchAttach", "shuffleDeck"],
  // Koraidon (1 list)
  "SSP-116#attack:Unrelenting Onslaught": ["conditionalDamage", "turnHistory"],
  // Leafeon ex (1 list)
  "PRE-6#attack:Verdant Storm": ["scaleDamage"],
  "PRE-6#attack:Moss Agate": ["heal"],
  // Light Ball (2 lists)
  "ASC-191#text": ["damageBonus"],
  // Lilligant (1 list)
  "JTG-7#ability:Sunny Day": ["damageBonus"],
  // Lively Stadium (3 lists)
  "SSP-180#text": ["hpBonus"],
  // Magnetic Metal Energy (2 lists)
  "CRI-85#text": ["retreatCost", "energyProvided"],
  // Manectric (4 lists)
  "PBL-24#attack:Flashing Barrier": ["preventDamage", "timedMarker"],
  "PBL-24#attack:Sonic Edge": ["ignoreDefenderEffects"],
  // Marnie's Morpeko (1 list)
  "DRI-137#attack:Spiky Wheel": ["scaleDamage"],
  // Mega Audino ex (3 lists)
  "ASC-172#attack:Kaleidowaltz": ["flip", "searchAttach", "shuffleDeck"],
  "ASC-172#attack:Ear Force": ["scaleDamage"],
  // Mega Chandelure ex (4 lists)
  "PBL-38#ability:Binding Flame": ["retreatCost"],
  "PBL-38#attack:Phantom Maze": ["scaleDamage", "retreatCost"],
  // Mega Darkrai ex (1 list)
  "PBL-48#attack:Dusk Raid": ["conditionalDamage"],
  "PBL-48#attack:Abyss Eye": ["knockOut"],
  // Mega Diancie ex (1 list)
  "PFL-41#ability:Diamond Coat": ["damageReduction"],
  "PFL-41#attack:Garland Ray": ["discardEnergy", "scaleDamage"],
  // Mega Eelektross ex (3 lists)
  "ASC-61#attack:Split Bomb": ["damage"],
  "ASC-61#attack:Disaster Shock": ["discardEnergy", "applyCondition"],
  // Mega Manectric ex (4 lists)
  "MEG-50#attack:Flash Ray": ["preventDamage", "timedMarker"],
  "MEG-50#attack:Riotous Blasting": ["discardEnergy", "conditionalDamage"],
  // Mega Mawile ex (3 lists)
  "MEG-94#attack:Gobble Down": ["scaleDamage"],
  "MEG-94#attack:Huge Bite": ["conditionalDamage"],
  // Mega Meganium ex (2 lists)
  "ASC-10#attack:Giant Bouquet": ["scaleDamage"],
  // Mega Slowbro ex (2 lists)
  "PBL-31#attack:Shellnado Spin": ["placeCounters", "timedMarker", "onDamagedByAttack"],
  // Minccino (1 list)
  "CRI-72#attack:Take Down": ["selfDamage"],
  // Mystery Garden (1 list)
  "MEG-122#text": ["stadiumAction", "discardFromHand", "drawUntil"],
  // N's Vanilluxe (1 list)
  "ASC-51#attack:Snow Coating": ["multiplyCounters"],
  "ASC-51#attack:Blizzard": ["damage"],
  // Payapa Berry (2 lists)
  "SCR-141#text": ["damageReduction", "onDamagedByAttack"],
  // Petilil (1 list)
  "BLK-6#attack:Hide": ["flip", "preventDamage", "preventEffects", "timedMarker"],
  // Philippe (4 lists)
  "CRI-79#text": ["attachFromDiscard"],
  // Pikachu ex (2 lists)
  "SSP-57#ability:Resolute Heart": ["surviveKnockOut"],
  "SSP-57#attack:Topaz Bolt": ["discardEnergy"],
  // Poké Ball (1 list)
  "POR-80#text": ["searchDeck", "shuffleDeck", "flip"],
  // Raging Bolt (1 list)
  "SCR-111#attack:Thunderburst Storm": ["damage", "scaleDamage"],
  // Rillaboom (1 list)
  "TWM-16#attack:Drum Beating": ["attackCost", "retreatCost", "timedMarker"],
  "TWM-16#attack:Wood Hammer": ["selfDamage"],
  // Sacred Charm (3 lists)
  "PFL-93#text": ["damageReduction"],
  // Scream Tail ex (1 list)
  "TWM-94#attack:Scream": ["playLock", "timedMarker", "firstTurnRule"],
  "TWM-94#attack:Crunch": ["discardEnergy"],
  // Seismitoad (4 lists)
  "30C-84#attack:Quaking Fist": ["flip", "playLock", "timedMarker"],
  // Shadowy Darkness Energy (1 list)
  "PBL-83#text": ["preventDamage", "energyProvided"],
  // Steven's Metagross ex (3 lists)
  "DRI-145#ability:X-Boot": ["searchAttach", "shuffleDeck", "oncePerTurn"],
  // Steven's Metang (3 lists)
  "DRI-144#attack:Metal Slash": ["attackLock", "timedMarker"],
  // Sylveon ex (1 list)
  "30C-71#attack:Colorful Harmony": ["scaleDamage"],
  // Team Rocket's Crobat ex (1 list)
  "DRI-122#ability:Biting Spree": ["placeCounters", "onEvolve"],
  "DRI-122#attack:Assassin's Return": ["scoop"],
  // Team Rocket's Golbat (1 list)
  "DRI-121#ability:Sneaky Bite": ["placeCounters", "onEvolve"],
  "DRI-121#attack:Confuse Ray": ["applyCondition"],
  // Team Rocket's Zubat (1 list)
  "DRI-120#attack:Poison Spray": ["applyCondition"],
  // Tynamo (4 lists)
  "ASC-59#attack:Hold Still": ["heal"],
  // Voltaic Lightning Energy (2 lists)
  "PBL-84#text": ["damageBonus", "energyProvided"],
  // Yanma (1 list)
  "DRI-2#attack:Whirlwind": ["pushOut"],
  // Yanmega ex (1 list)
  "DRI-3#ability:Buzzing Boost": ["searchAttach", "shuffleDeck", "oncePerTurn"],
  "DRI-3#attack:Jet Cyclone": ["moveEnergy"],
}
