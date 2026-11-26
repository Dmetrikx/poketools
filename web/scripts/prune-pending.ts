// Removes every implemented effect from src/game/cards/pending.ts.
// Run after adding card definitions: npx vite-node scripts/prune-pending.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registeredEffects } from '../src/game/cards'

const file = join(dirname(fileURLToPath(import.meta.url)), '../src/game/cards/pending.ts')
const done = registeredEffects()
const lines = readFileSync(file, 'utf8').split('\n')
const kept = lines.filter(l => {
  const m = /^\s+"([^"]+)":/.exec(l)
  return !m || !done.has(m[1])
})
// Drop card-name comments left without entries.
const out = kept.filter((l, i) => !(l.trim().startsWith('// ') && /^\s+\/\/ /.test(l) && (kept[i + 1]?.trim().startsWith('// ') || kept[i + 1]?.trim() === '}')))
writeFileSync(file, out.join('\n'))
console.log(`removed ${lines.length - out.length} lines; ${out.filter(l => /^\s+"/.test(l)).length} effects pending`)
