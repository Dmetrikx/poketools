// end this is empty.

import type { EffectKey } from './effectKeys'
import type { Primitive } from './taxonomy'

export const pending: Record<EffectKey, Primitive[]> = {
  // Abra
  "MEG-54#attack:Teleportation Attack": ["switchSelf"],
  // Alakazam
  "TWM-82#attack:Strange Hacking": ["moveCounters", "applyCondition"],
  "TWM-82#attack:Psychic": ["scaleDamage"],
  // Annihilape
  "PBL-41#ability:Durable Body": ["flip", "surviveKnockOut"],
  "PBL-41#attack:Ghostly Blow": ["placeCounters"],
  "SSP-100#attack:Tantrum": ["applyCondition"],
  "SSP-100#attack:Destined Fight": ["knockOut"],
  // Applin
  "TWM-126#attack:Find a Friend": ["searchDeck", "shuffleDeck"],
  // Arboliva ex
  "DRI-23#attack:Oil Salvo": ["damage", "ignoreWeaknessResistance"],
  "DRI-23#attack:Aroma Shot": ["removeConditions"],
  // Banette
  "PBL-34#ability:Hide 'n' Sneak": ["preventEffects"],
  "PBL-34#attack:Puppet Pull": ["searchDeck", "shuffleDeck"],
  // Beedrill ex
  "CRI-3#attack:Rumbling Bees": ["scaleDamage"],
  // Blaziken ex
  "JTG-24#ability:Seething Spirit": ["attachFromDiscard", "oncePerTurn"],
  "JTG-24#attack:Smolder-sault": ["attackLock", "timedMarker"],
  // Bloodmoon Ursaluna ex
  "TWM-141#ability:Seasoned Skill": ["attackCost"],
  "TWM-141#attack:Blood Moon": ["attackLock", "timedMarker"],
  // Bulbasaur
  "MEG-1#attack:Bind Down": ["retreatLock", "timedMarker"],
  // Buneary
  "MEG-107#attack:Charm": ["damageReduction", "timedMarker"],
  "PFL-83#attack:Run Around": ["switchSelf"],
  // Cacnea
  "DLR-4#attack:Knock Away": ["flip", "conditionalDamage"],
  // Cacturne
  "DLR-5#attack:Linear Attack": ["damage", "ignoreWeaknessResistance"],
  "DLR-5#attack:Punishing Needles": ["scaleDamage"],
  // Carvanha
  "PFL-60#attack:Reckless Charge": ["selfDamage"],
  // Charmander
  "PFL-11#ability:Agile": ["retreatCost"],
  // Chi-Yu
  "PBL-59#attack:Whirling Envy": ["conditionalDamage", "ignoreWeaknessResistance"],
  "TWM-39#attack:Allure": ["draw"],
  "TWM-39#attack:Ground Melter": ["discardStadium", "conditionalDamage"],
  // Chikorita
  "ASC-8#attack:Growl": ["damageReduction", "timedMarker"],
  // Cofagrigus
  "SSP-83#attack:Law of the Underworld": ["placeCounters"],
  // Combusken
  "DRI-41#attack:Double Kick": ["flip", "scaleDamage"],
  // Cynthia's Gabite
  "DRI-103#ability:Champion's Call": ["searchDeck", "shuffleDeck", "oncePerTurn"],
  // Cynthia's Garchomp ex
  "DRI-104#attack:Corkscrew Dive": ["drawUntil"],
  "DRI-104#attack:Draconic Buster": ["discardEnergy"],
  // Cynthia's Gible
  "DRI-102#attack:Rock Hurl": ["ignoreWeaknessResistance"],
  // Cynthia's Roserade
  "DRI-8#ability:Cheer On to Glory": ["damageBonus"],
  // Cynthia's Spiritomb
  "DRI-129#attack:Raging Curse": ["scaleDamage", "ignoreWeaknessResistance"],
  // Dedenne
  "SSP-87#attack:Electromagnetic Sonar": ["recoverFromDiscard"],
  // Dhelmise
  "PBL-39#attack:Vengeful Anchor": ["conditionalDamage"],
  // Dolliv
  "DRI-22#attack:Nutrients": ["heal"],
  // Drapion
  "POR-52#attack:Hazardous Tail": ["selfDamage", "applyCondition"],
  // Dusclops
  "PRE-36#ability:Cursed Blast": ["placeCounters", "knockOut", "oncePerTurn"],
  // Dusknoir
  "PRE-37#ability:Cursed Blast": ["placeCounters", "knockOut", "oncePerTurn"],
  "PRE-37#attack:Shadow Bind": ["retreatLock", "timedMarker"],
  // Duskull
  "PRE-35#attack:Come and Get You": ["discardToBench"],
  // Eevee ex
  "PRE-75#ability:Rainbow DNA": ["evolutionRule", "firstTurnRule"],
  // Empoleon ex
  "PFL-70#ability:Emperor's Stance": ["preventEffects"],
  "PFL-70#attack:Iron Feathers": ["damageReduction", "timedMarker"],
  // Enamorus
  "TWM-93#attack:Love Resonance": ["conditionalDamage"],
  // Ethan's Cyndaquil
  "DRI-32#attack:Ember": ["discardEnergy"],
  // Ethan's Quilava
  "DRI-33#ability:Bonded by the Journey": ["searchDeck", "shuffleDeck", "oncePerTurn"],
  // Ethan's Typhlosion
  "DRI-34#attack:Buddy Blast": ["scaleDamage"],
  // Fan Rotom
  "SCR-118#ability:Fan Call": ["searchDeck", "shuffleDeck", "oncePerTurn", "firstTurnRule"],
  "SCR-118#attack:Assault Landing": ["conditionalDamage"],
  // Flutter Mane
  "TEF-78#ability:Midnight Fluttering": ["activeOnly", "abilityLock"],
  "TEF-78#attack:Hex Hurl": ["placeCounters", "distributeCounters"],
  // Frillish
  "WHT-44#attack:Oceanic Gloom": ["playLock", "timedMarker"],
  // Froakie
  "CRI-20#attack:Collect": ["draw"],
  // Frogadier
  "CRI-21#attack:Summoning Jutsu": ["searchDeck", "shuffleDeck"],
  // Froslass
  "TWM-53#ability:Freezing Shroud": ["placeCounters", "onCheckup"],
  // Giratina
  "DLR-45#attack:Chaos Crawler": ["preventDamage", "attackLock", "timedMarker", "turnHistory"],
  // Goldeen
  "TWM-44#ability:Festival Lead": ["attackTwice"],
  "TWM-44#attack:Whirlpool": ["discardEnergy", "flip"],
  // Greninja ex
  "30C-21#attack:Stealthy Slash": ["damage", "scaleDamage", "ignoreWeaknessResistance"],
  "TWM-106#attack:Shinobi Blade": ["searchDeck", "shuffleDeck"],
  "TWM-106#attack:Mirage Barrage": ["discardEnergy", "damage", "ignoreWeaknessResistance"],
  // Hariyama
  "MEG-73#ability:Heave-Ho Catcher": ["gust", "onEvolve", "oncePerTurn"],
  "MEG-73#attack:Wild Press": ["selfDamage"],
  // Haxorus
  "BLK-70#attack:Cross-Cut": ["conditionalDamage"],
  "BLK-70#attack:Axe Blast": ["knockOut"],
  // Hoothoot
  "SCR-114#attack:Triple Stab": ["flip", "scaleDamage"],
  // Iron Crown ex
  "TEF-81#ability:Cobalt Command": ["damageBonus"],
  "TEF-81#attack:Twin Shotels": ["damage", "ignoreWeaknessResistance"],
  // Iron Leaves ex
  "TEF-25#ability:Rapid Vernier": ["moveEnergy", "switchSelf", "onPlayToBench"],
  "TEF-25#attack:Prism Edge": ["attackLock", "timedMarker"],
  // Jirachi ex
  "30C-102#attack:Wish Granter": ["drawUntil"],
  "30C-102#attack:Swift": ["ignoreWeaknessResistance"],
  // Jolteon ex
  "PRE-30#attack:Flashing Spear": ["discardEnergy", "scaleDamage"],
  "PRE-30#attack:Dravite": ["attackLock", "timedMarker"],
  // Kakuna
  "CRI-2#ability:Exoskeleton": ["damageReduction"],
  // Lucario
  "30C-83#attack:Aura Sphere": ["damage", "ignoreWeaknessResistance"],
  // Lugia
  "30C-121#attack:Elemental Blast": ["discardEnergy"],
  // Lunatone
  "MEG-74#ability:Lunar Cycle": ["draw", "discardFromHand", "oncePerTurn", "playCondition"],
  // Marnie's Grimmsnarl ex
  "DRI-136#ability:Punk Up": ["searchAttach", "shuffleDeck", "onEvolve"],
  "DRI-136#attack:Shadow Bullet": ["damage", "ignoreWeaknessResistance"],
  // Marnie's Impidimp
  "DRI-134#attack:Filch": ["draw"],
  // Mega Charizard X ex
  "PFL-13#attack:Inferno X": ["discardEnergy", "scaleDamage"],
  // Mega Charizard Y ex
  "ASC-22#attack:Explosion Y": ["discardEnergy", "damage", "ignoreWeaknessResistance"],
  // Mega Froslass ex
  "ASC-47#attack:Resentful Refrain": ["scaleDamage"],
  "ASC-47#attack:Absolute Snow": ["applyCondition"],
  // Mega Greninja ex
  "CRI-22#ability:Mortal Shuriken": ["discardFromHand", "placeCounters", "oncePerTurn", "activeOnly", "playCondition"],
  "CRI-22#attack:Ninja Spinner": ["energyToHand", "conditionalDamage"],
  // Mega Latias ex
  "MEG-100#attack:Strafe": ["switchSelf"],
  "MEG-100#attack:Illusory Impulse": ["discardEnergy"],
  // Mega Lopunny ex
  "PFL-84#attack:Gale Thrust": ["conditionalDamage", "turnHistory"],
  "PFL-84#attack:Spiky Hopper": ["ignoreDefenderEffects"],
  // Mega Lucario ex
  "MEG-77#attack:Aura Jab": ["attachFromDiscard"],
  "MEG-77#attack:Mega Brave": ["attackLock", "timedMarker"],
  // Mega Sharpedo ex
  "PFL-61#attack:Greedy Fang": ["draw"],
  "PFL-61#attack:Hungry Jaws": ["conditionalDamage"],
  // Mega Starmie ex
  "POR-21#attack:Jetting Blow": ["damage", "ignoreWeaknessResistance"],
  "POR-21#attack:Nebula Beam": ["ignoreWeaknessResistance"],
  // Mega Venusaur ex
  "MEG-3#ability:Solar Transfer": ["moveEnergy", "repeatable"],
  "MEG-3#attack:Jungle Dump": ["heal"],
  // Moltres
  "PFL-14#attack:Fighting Wings": ["conditionalDamage"],
  // N's Darmanitan
  "JTG-27#attack:Back Draft": ["scaleDamage"],
  "JTG-27#attack:Flamebody Cannon": ["discardEnergy", "damage", "ignoreWeaknessResistance"],
  // N's Purrloin
  "JTG-96#attack:Thieving Swipe": ["revealHand"],
  // N's Reshiram
  "JTG-116#attack:Powerful Rage": ["scaleDamage"],
  // Noctowl
  "SCR-115#ability:Jewel Seeker": ["searchDeck", "shuffleDeck", "onEvolve", "oncePerTurn"],
  // Okidogi
  "TWM-111#ability:Adrena-Power": ["damageBonus", "hpBonus"],
  // Oricorio ex
  "PFL-18#ability:Excited Turbo": ["repeatable", "attachFromHand"],
  // Paldean Tauros
  "SSP-18#attack:Spirited Tackle": ["conditionalDamage"],
  // Patrat
  "CRI-70#ability:Watchful Eye": ["counterMoveLock"],
  // Pawmot
  "PFL-34#attack:Voltaic Fist": ["applyCondition", "selfDamage"],
  // Pecharunt
  "SVP-149#ability:Toxic Subjugation": ["placeCounters", "onCheckup", "activeOnly"],
  "SVP-149#attack:Poison Chain": ["applyCondition", "retreatLock", "timedMarker"],
  // Pikipek
  "PBL-66#attack:Double Stab": ["flip", "scaleDamage"],
  // Piplup
  "PFL-27#attack:Call for Support": ["searchDeck", "shuffleDeck"],
  // Poltchageist
  "PBL-5#ability:Hide 'n' Sneak": ["preventEffects"],
  "PBL-5#attack:Furtive Drop": ["placeCounters"],
  // Psyduck
  "ASC-39#ability:Damp": ["abilityLock"],
  // Rabsca
  "TEF-24#ability:Spherical Shield": ["preventDamage"],
  "TEF-24#attack:Psychic": ["scaleDamage"],
  // Regigigas
  "PRE-86#attack:Jewel Breaker": ["conditionalDamage"],
  // Rellor
  "DRI-24#attack:Collect": ["draw"],
  "TEF-23#attack:Slight Intrusion": ["selfDamage"],
  // Reshiram
  "30C-14#attack:Laser Flame": ["conditionalDamage"],
  // Reshiram ex
  "WHT-20#attack:Blazing Burst": ["discardEnergy", "scaleDamage"],
  // Riolu
  "MEG-76#attack:Accelerating Stab": ["attackLock", "timedMarker"],
  "PRE-50#attack:Quick Attack": ["flip", "conditionalDamage"],
  // Seaking
  "PRE-21#ability:Festival Lead": ["attackTwice"],
  "PRE-21#attack:Rapid Draw": ["draw"],
  // Shuppet
  "PBL-33#ability:Hide 'n' Sneak": ["preventEffects"],
  // Sinistcha
  "PBL-6#ability:Hide 'n' Sneak": ["preventEffects"],
  "PBL-6#attack:Matcha Spin": ["placeCounters"],
  // Slowpoke
  "MEP-86#ability:Dopey Face": ["conditionImmunity"],
  // Solrock
  "MEG-75#attack:Cosmic Beam": ["conditionalDamage", "ignoreWeaknessResistance"],
  // Spiritomb
  "PBL-35#attack:Spiritual End": ["multiplyCounters"],
  // Tapu Bulu
  "SFA-6#attack:Wood Hammer": ["selfDamage"],
  // Tapu Koko ex
  "JTG-51#attack:Linked Lightning": ["scaleDamage"],
  // Tatsugiri
  "TWM-131#ability:Attract Customers": ["lookAtTop", "shuffleDeck", "oncePerTurn", "activeOnly"],
  // Team Rocket's Articuno
  "DRI-51#ability:Repelling Veil": ["preventEffects"],
  "DRI-51#attack:Dark Frost": ["conditionalDamage"],
  // Team Rocket's Honchkrow
  "ASC-127#attack:Rocket Feathers": ["discardFromHand", "scaleDamage"],
  // Team Rocket's Mewtwo ex
  "DRI-81#ability:Power Saver": ["attackRequirement"],
  "DRI-81#attack:Erasure Ball": ["discardEnergy", "scaleDamage"],
  // Team Rocket's Mimikyu
  "DRI-87#attack:Gemstone Mimicry": ["copyAttack"],
  // Team Rocket's Murkrow
  "DRI-127#attack:Deceit": ["searchDeck", "shuffleDeck"],
  "DRI-127#attack:Torment": ["attackLock", "timedMarker"],
  // Team Rocket's Porygon
  "DRI-153#attack:Hacking": ["discardFromHand"],
  // Team Rocket's Porygon2
  "DRI-154#attack:R Command": ["scaleDamage"],
  // Team Rocket's Sneasel
  "DRI-128#attack:Strike the Sleeper": ["damage", "scaleDamage", "ignoreWeaknessResistance"],
  // Team Rocket's Spidops
  "DRI-20#ability:Charging Up": ["attachFromDiscard", "oncePerTurn"],
  "DRI-20#attack:Rocket Rush": ["scaleDamage"],
  // Team Rocket's Tarountula
  "DRI-19#attack:Take Down": ["selfDamage"],
  // Team Rocket's Wobbuffet
  "DRI-82#attack:Rocket Mirror": ["moveCounters"],
  // Terapagos ex
  "SCR-128#attack:Unified Beatdown": ["scaleDamage", "firstTurnRule"],
  "SCR-128#attack:Crown Opal": ["preventDamage", "timedMarker"],
  // Thwackey
  "TWM-15#ability:Boom Boom Groove": ["searchDeck", "shuffleDeck", "oncePerTurn"],
  // Torchic
  "DRI-40#attack:Collect": ["draw"],
  // Toucannon
  "PBL-68#ability:Aerial Draw": ["draw", "oncePerTurn"],
  "PBL-68#attack:Feather Rondo": ["scaleDamage"],
  // Toxel
  "PFL-67#attack:Call for Family": ["searchToBench", "shuffleDeck"],
  // Toxtricity
  "PFL-68#ability:Sinister Surge": ["searchAttach", "shuffleDeck", "placeCounters", "oncePerTurn"],
  // Unown
  "30C-72#attack:Mysterious Signal": ["prizeCount"],
  // Victini
  "SSP-21#ability:Victory Cheer": ["damageBonus"],
  // Volcanion ex
  "JTG-31#ability:Scalding Steam": ["applyCondition", "oncePerTurn", "activeOnly"],
  "JTG-31#attack:Scorching Cyclone": ["moveEnergy"],
  // Weedle
  "CRI-1#attack:Surprise Attack": ["flip", "conditionalDamage"],
  // Yveltal
  "30C-100#ability:Life-Locked": ["healLock"],
  "MEG-88#attack:Clutch": ["retreatLock", "timedMarker"],
}
