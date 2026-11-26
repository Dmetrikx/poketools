// Importing this module registers every card definition. Card files call
// defineCard at module load; add each new file here.
import './rules'

export { cardDefinition, registeredEffects, registryImpls } from './registry'
