// Importing this module registers every card definition. Card files call
// defineCard at module load; add each new file here.
import './rules'
import './trainers/supporters'
import './trainers/items'
import './trainers/tools'
import './trainers/stadiums'
import './energy'
import './pokemon/dragapult'
import './pokemon/basicbox'
import './pokemon/zoroark-slowking'
import './pokemon/crustle-hydrapple'
import './pokemon/metal-psychic'

export { cardDefinition, registeredEffects, registryImpls } from './registry'
