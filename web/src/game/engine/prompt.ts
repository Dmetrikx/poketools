import type { Answer, Proc, Prompt } from './types'

/**
 * Asks a question unless the answer is forced: no options (empty answer),
 * every option required, or a single option to pick.
 */
export function* ask(prompt: Prompt): Proc<Answer> {
  const forced = forcedAnswer(prompt)
  if (forced) return forced
  return yield prompt
}

export function forcedAnswer(p: Prompt): Answer | null {
  switch (p.kind) {
    case 'chooseCards':
    case 'choosePokemon':
      if (p.options.length === 0 || p.max === 0) return []
      if (p.min >= p.options.length && p.max >= p.options.length) return [...p.options]
      return null
    case 'chooseOption':
      return p.options.length === 1 ? [0] : null
    case 'order':
      return p.cards.length <= 1 ? [...p.cards] : null
    case 'distribute':
      return p.options.length === 1 ? [p.total] : null
    default:
      return null
  }
}

/** null if the answer fits the prompt, else why not. */
export function checkAnswer(p: Prompt, a: Answer): string | null {
  if (!Array.isArray(a) || a.some(n => !Number.isInteger(n))) return 'answer must be integers'
  switch (p.kind) {
    case 'chooseCards':
    case 'choosePokemon': {
      if (a.length < Math.min(p.min, p.options.length) || a.length > p.max) return `pick ${p.min}–${p.max}`
      if (new Set(a).size !== a.length) return 'duplicate pick'
      if (a.some(x => !p.options.includes(x))) return 'not an option'
      return null
    }
    case 'chooseOption':
      return a.length === 1 && a[0] >= 0 && a[0] < p.options.length ? null : 'pick one option'
    case 'yesNo':
      return a.length === 1 && (a[0] === 0 || a[0] === 1) ? null : 'answer yes (1) or no (0)'
    case 'order': {
      const sorted = [...a].sort((x, y) => x - y)
      const want = [...p.cards].sort((x, y) => x - y)
      return sorted.length === want.length && sorted.every((x, i) => x === want[i]) ? null : 'order every card once'
    }
    case 'distribute': {
      if (a.length !== p.options.length || a.some(n => n < 0)) return 'one count per option'
      if (a.reduce((x, y) => x + y, 0) !== p.total) return `counts must add up to ${p.total}`
      if (p.maxEach && a.some((n, i) => n > p.maxEach![i])) return 'too many on one option'
      return null
    }
  }
}
