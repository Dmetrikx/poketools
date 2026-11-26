import type { Answer, Prompt } from './types'

/** A random valid answer to a prompt, for fuzzing and placeholder opponents. */
export function randomAnswer(p: Prompt, rand: () => number): Answer {
  const pickN = <T>(items: T[], n: number): T[] => {
    const pool = [...items]
    const out: T[] = []
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
    return out
  }
  switch (p.kind) {
    case 'chooseCards':
    case 'choosePokemon': {
      const lo = Math.min(p.min, p.options.length)
      const hi = Math.min(p.max, p.options.length)
      return pickN(p.options, lo + Math.floor(rand() * (hi - lo + 1)))
    }
    case 'chooseOption':
      return [Math.floor(rand() * p.options.length)]
    case 'yesNo':
      return [rand() < 0.5 ? 1 : 0]
    case 'order':
      return pickN(p.cards, p.cards.length)
    case 'distribute': {
      const counts = p.options.map(() => 0)
      for (let left = p.total; left > 0;) {
        const i = Math.floor(rand() * counts.length)
        if (p.maxEach && counts[i] >= p.maxEach[i]) {
          if (counts.every((n, j) => n >= p.maxEach![j])) break
          continue
        }
        counts[i]++
        left--
      }
      return counts
    }
  }
}
