// Builds the matchup simulator's card catalog from the decklists of LAIC
// 2026-27 São Paulo and the Standard events after it (TOURNAMENTS). Run with
// `make catalog` (vite-node). Never runs in CI or at build time: its output is
// committed.
//
//   1. Limitless tournament pages → every list, deduplicated into the pool.
//   2. Limitless card page → text, trainer subtype, Tera rule, every print.
//      Pokémon whose prints overlap are one card.
//   3. TCGdex → trainer / energy text, cross-check, an image for each print.
//   4. Limitless search → Ancient / Future / ACE SPEC tags.
//
// Catalog ids are stable: a card keeps the id it has in the committed
// cards.json, and the build fails if one disappears. Responses are cached
// under scripts/.cache so a rerun is offline. Pass --refresh to refetch,
// --accept to write even though an existing id is gone.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Aliases, CatalogAbility, CatalogAttack, CatalogCard, CardKind, EnergyType,
  FixtureDeck, WeaknessResistance,
} from '../src/game/catalog/types'
import { normalizeName } from '../src/game/catalog/resolve'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, '../src/game/catalog')
const REPORT = join(HERE, 'catalog-report.md')

/** LAIC first: its lists are the fixture decks. */
const TOURNAMENTS = [574, 585, 584, 583, 582, 581, 580, 579, 578]
const FIXTURE_TOURNAMENT = 574
const LIMITLESS = 'https://limitlesstcg.com'
const TCGDEX = 'https://api.tcgdex.net/v2/en'
const USER_AGENT = 'Mozilla/5.0 (compatible; deck-tool/1.0)'
const DELAY_MS = 300

const PRINTS = join(OUT, 'prints.json')

/** Fail the build when fewer trainers than this have a second print: print discovery broke. */
const MIN_REPRINTED_TRAINERS = 0.3

const args = new Set(process.argv.slice(2))
const REFRESH = args.has('--refresh')
const ACCEPT = args.has('--accept')

// ── fetching ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function get(url: string): Promise<{ status: number; body: string }> {
  mkdirSync(CACHE, { recursive: true })
  const file = join(CACHE, createHash('sha1').update(url).digest('hex'))
  if (!REFRESH && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 0; ; attempt++) {
    await sleep(url.startsWith(TCGDEX) ? 50 : DELAY_MS)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      const out = { status: res.status, body: await res.text() }
      if (res.status >= 500 && attempt < 3) continue
      if (out.status === 200 || out.status === 404) writeFileSync(file, JSON.stringify(out))
      return out
    } catch (err) {
      if (attempt >= 3) throw err
    }
  }
}

async function getJSON<T>(url: string): Promise<T | null> {
  const { status, body } = await get(url)
  if (status !== 200 && status !== 404) throw new Error(`${url}: HTTP ${status}`)
  return status === 200 ? JSON.parse(body) as T : null
}

// ── html helpers ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»' }

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
}

/** Text content of an HTML fragment: symbols as {G}, paragraphs as "\n", spaces collapsed. */
function text(html: string): string {
  return tidy(decode(html.replace(/\s+/g, ' ').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\[\s*([GRWLPFDMCNY])\s*\]/g, '{$1}'))
}

function tidy(s: string): string {
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .replace(/ +([.,)])/g, '$1')
    .replace(/\( +/g, '(')
    .trim()
}

const SYMBOL_OF: Record<string, string> = {
  Grass: 'G', Fire: 'R', Water: 'W', Lightning: 'L', Psychic: 'P', Fighting: 'F',
  Darkness: 'D', Metal: 'M', Dragon: 'N', Fairy: 'Y', Colorless: 'C',
}

/** TCGdex text, minus the HTML some recent sets carry. */
function clean(s: string | undefined): string {
  if (!s) return ''
  return tidy(decode(s
    .replace(/<span class="energy-symbol (\w+)"[^>]*>[^<]*<\/span>/g, (_, t) => `{${SYMBOL_OF[t] ?? t}}`)
    .replace(/<\/p>\s*<p>/g, '\n')
    .replace(/<[^>]+>/g, '')))
}

const SYMBOL: Record<string, EnergyType> = {
  G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting',
  D: 'Darkness', M: 'Metal', N: 'Dragon', Y: 'Fairy', C: 'Colorless',
}

// ── 1. the pool ─────────────────────────────────────────────────────────────

interface ListCard { limitlessId: string; set: string; number: string; kind: CardKind; name: string; count: number }
interface List { tournament: number; archetype: string; placing: number; cards: ListCard[] }

/** `SET-number` with a numeric number unpadded, the form Limitless links use. */
function pk(set: string, number: string): string {
  return `${set.toUpperCase()}-${/^\d+$/.test(number) ? String(Number(number)) : number.toUpperCase()}`
}

function parseLists(html: string, tournament: number): List[] {
  const lists: List[] = []
  const blocks = html.split('<div class="tournament-decklist">').slice(1)
  for (const [i, block] of blocks.entries()) {
    const toggle = /data-toggle data-target="[^"]*">\s*(\d+)/.exec(block)
    const title = /<div class="decklist" [^>]*data-title="([^"]*)"/.exec(block)
    if (!title) throw new Error(`list ${i}: no title`)
    const cards: ListCard[] = []
    const re = /<div class="decklist-card" data-id="(\d+)" data-set="([^"]*)" data-number="([^"]*)"[^>]*?data-type="(\w+)" data-name="([^"]*)"[\s\S]*?<span class="card-count">(\d+)<\/span>/g
    for (const m of block.matchAll(re)) {
      cards.push({
        limitlessId: m[1], set: m[2], number: m[3], kind: m[4] as CardKind,
        name: decode(m[5]), count: Number(m[6]),
      })
    }
    const total = cards.reduce((n, c) => n + c.count, 0)
    if (total !== 60) throw new Error(`tournament ${tournament} list ${i} (${decode(title[1])}) has ${total} cards`)
    lists.push({ tournament, archetype: decode(title[1]), placing: toggle ? Number(toggle[1]) : i + 1, cards })
  }
  return lists
}

interface PoolCard {
  key: string
  kind: CardKind
  name: string
  /** Prints seen in lists with how often they were played. */
  printsSeen: Map<string, number>
  /** Indexes of the lists that play it. */
  inLists: Set<number>
}

/**
 * First pass: Pokémon by Limitless id, the rest by name. Pokémon groups are
 * merged again by their prints once the card pages are in (mergeByPrints).
 */
function buildPool(lists: List[]): PoolCard[] {
  const pool = new Map<string, PoolCard>()
  for (const [i, list] of lists.entries()) {
    for (const c of list.cards) {
      const key = c.kind === 'pokemon' ? `p:${c.limitlessId}` : `${c.kind[0]}:${c.name}`
      let p = pool.get(key)
      if (!p) pool.set(key, p = { key, kind: c.kind, name: c.name, printsSeen: new Map(), inLists: new Set() })
      const print = pk(c.set, c.number)
      p.printsSeen.set(print, (p.printsSeen.get(print) ?? 0) + c.count)
      p.inLists.add(i)
    }
  }
  return [...pool.values()]
}

function mainPrint(p: PoolCard): string {
  return [...p.printsSeen].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}

// ── 2. TCGdex ───────────────────────────────────────────────────────────────

interface TcgdexCard {
  id: string
  name: string
  category: string
  hp?: number
  types?: string[]
  stage?: string
  evolveFrom?: string
  suffix?: string
  rarity?: string
  attacks?: { cost?: string[]; name: string; effect?: string; damage?: string | number }[]
  abilities?: { type: string; name: string; effect: string }[]
  weaknesses?: { type: string; value?: string }[]
  resistances?: { type: string; value?: string }[]
  retreat?: number
  effect?: string
  trainerType?: string
  energyType?: string
  regulationMark?: string
}

const SET_OVERRIDES: Record<string, string> = {
  MEE: 'mee', MEG: 'me01', PFL: 'me02', ASC: 'me02.5', POR: 'me03', CRI: 'me04', PBL: 'me05',
  DLR: 'me06', '30C': '30th', MEP: 'mep', JTG: 'sv09', TWM: 'sv06', WHT: 'sv10.5w', BLK: 'sv10.5b',
  SP: 'swshp',
}

const setIds = new Map<string, string | null>()

async function tcgdexSet(code: string): Promise<string | null> {
  if (SET_OVERRIDES[code]) return SET_OVERRIDES[code]
  if (setIds.has(code)) return setIds.get(code)!
  const sets = await getJSON<{ id: string }[]>(`${TCGDEX}/sets?abbreviation.official=eq:${encodeURIComponent(code)}`)
  const id = sets && sets.length === 1 ? sets[0].id : null
  setIds.set(code, id)
  return id
}

/** Candidate TCGdex ids for a print: zero-padded (SV onward) first, then as printed. */
async function tcgdexIds(print: string): Promise<string[]> {
  const [code, number] = splitPrint(print)
  const set = await tcgdexSet(code)
  if (!set) return []
  const ids = /^\d+$/.test(number) ? [`${set}-${number.padStart(3, '0')}`, `${set}-${number}`] : [`${set}-${number}`]
  return [...new Set(ids)]
}

async function fetchTcgdex(print: string): Promise<TcgdexCard | null> {
  for (const id of await tcgdexIds(print)) {
    const card = await getJSON<TcgdexCard>(`${TCGDEX}/cards/${id}`)
    if (card) return card
  }
  return null
}

const setImages = new Map<string, Map<string, string>>()

/** localId → image for every card of a TCGdex set that has one. */
async function tcgdexSetImages(set: string): Promise<Map<string, string>> {
  let images = setImages.get(set)
  if (!images) {
    const data = await getJSON<{ cards: { localId: string; image?: string }[] }>(`${TCGDEX}/sets/${set}`)
    images = new Map((data?.cards ?? []).filter(c => c.image).map(c => [c.localId, c.image!]))
    setImages.set(set, images)
  }
  return images
}

/** TCGdex image of exactly this print, if TCGdex has one. */
async function printImage(print: string): Promise<string | undefined> {
  const [code] = splitPrint(print)
  const set = await tcgdexSet(code)
  if (!set) return undefined
  const images = await tcgdexSetImages(set)
  for (const id of await tcgdexIds(print)) {
    const img = images.get(id.slice(set.length + 1))
    if (img) return img
  }
  return undefined
}

/** The app's basic energy art: the first `swsh` print of that name, as the server picks it. */
async function basicEnergyImage(name: string): Promise<string | undefined> {
  const found = await getJSON<{ name: string; image?: string }[]>(`${TCGDEX}/cards?name=${encodeURIComponent(name)}&set=swsh`)
  return found?.find(c => c.name === name && c.image)?.image
}

function splitPrint(print: string): [string, string] {
  const i = print.lastIndexOf('-')
  return [print.slice(0, i), print.slice(i + 1)]
}

// ── 3. Limitless card page ─────────────────────────────────────────────────

interface LimitlessCard {
  name: string
  typeLine: string[]
  hp?: number
  types?: EnergyType[]
  attacks: CatalogAttack[]
  abilities: CatalogAbility[]
  rules: string[]
  text: string
  weakness: WeaknessResistance | null
  resistance: WeaknessResistance | null
  retreat?: number
  regulationMark?: string
  prints: string[]
  /** Limitless CDN image of this print. */
  image?: string
}

function parseLimitlessCard(html: string): LimitlessCard {
  const start = html.indexOf('<div class="card-text">')
  const end = html.indexOf('<div class="card-legality">', start)
  if (start < 0 || end < 0) throw new Error('no card text')
  const body = html.slice(start, end)

  const title = /<p class="card-text-title">([\s\S]*?)<\/p>/.exec(body)![1]
  const name = text(/<span class="card-text-name">([\s\S]*?)<\/span>/.exec(title)![1])
  const titleParts = text(title).split(' - ').slice(1).map(s => s.trim())
  const hpPart = titleParts.find(s => /HP$/.test(s))
  const types = titleParts.filter(s => !/HP$/.test(s)).flatMap(s => s.split('/')).map(s => s.trim()) as EnergyType[]
  const typeLine = text(/<p class="card-text-type">([\s\S]*?)<\/p>/.exec(body)![1]).split(' - ').map(s => s.trim())

  const abilities: CatalogAbility[] = []
  const rules: string[] = []
  for (const m of body.matchAll(/<div class="card-text-ability">\s*<p class="card-text-ability-info">([\s\S]*?)<\/p>\s*<p class="card-text-ability-effect">([\s\S]*?)<\/p>/g)) {
    const info = text(m[1])
    const effect = text(m[2])
    if (/^Ability:/.test(info)) abilities.push({ name: info.replace(/^Ability:\s*/, ''), text: effect })
    else rules.push(effect)
  }

  const attacks: CatalogAttack[] = []
  for (const m of body.matchAll(/<div class="card-text-attack">\s*<p class="card-text-attack-info">([\s\S]*?)<\/p>(?:\s*<p class="card-text-attack-effect">([\s\S]*?)<\/p>)?/g)) {
    const symbols = /<span class="ptcg-symbol">([^<]*)<\/span>/.exec(m[1])?.[1].trim() ?? ''
    const rest = text(m[1].replace(/<span class="ptcg-symbol">[^<]*<\/span>/, ''))
    const dmg = /\s(\d+[+×x-]?)$/.exec(rest)
    attacks.push({
      name: dmg ? rest.slice(0, dmg.index).trim() : rest,
      cost: [...symbols.replace(/\s/g, '')].filter(ch => ch !== '0').map(ch => SYMBOL[ch]),
      damage: dmg ? dmg[1].replace('x', '×') : '',
      text: m[2] ? text(m[2]) : '',
    })
  }

  // Trainer / energy text is the bare second section.
  const sections = body.split('<div class="card-text-section').slice(1)
  const second = sections[1] ?? ''
  const effect = typeLine[0] !== 'Pokémon' && !second.startsWith(' card-text-artist')
    ? text(second.slice(second.indexOf('>') + 1))
    : ''

  const wrr = /<p class="card-text-wrr">([\s\S]*?)<\/p>/.exec(body)
  const wr = (label: string): WeaknessResistance | null => {
    if (!wrr) return null
    const m = new RegExp(`${label}:\\s*([^<]*)<`).exec(wrr[1])
    const v = m?.[1].trim() ?? 'none'
    if (v === 'none') return null
    const parts = /^(\w+)\s*(.*)$/.exec(v)!
    return { type: parts[1] as EnergyType, value: parts[2] || (label === 'Weakness' ? '×2' : '-30') }
  }
  const retreat = wrr ? Number(/Retreat:\s*(\d+)/.exec(wrr[1])?.[1] ?? 0) : undefined

  const mark = /<div class="regulation-mark">\s*([A-Z]) Regulation Mark/.exec(html)?.[1]

  // The current print is a row without a link: take it from data-location.
  // International prints are the rows up to the JP. Prints header; their
  // links carry extra spaces (`<a  href=`).
  const prints: string[] = []
  const current = /data-location="([^"/]+)\/([^"]+)"/.exec(html)
  if (current) prints.push(pk(current[1], current[2]))
  const table = /<table class="card-prints-versions">([\s\S]*?)<\/table>/.exec(html)?.[1] ?? ''
  const from = table.indexOf('Int. Prints')
  const to = table.indexOf('JP. Prints')
  const intl = from < 0 ? '' : table.slice(from, to > from ? to : undefined)
  for (const m of intl.matchAll(/<a\s+href="\/cards\/([A-Za-z0-9]+)\/([A-Za-z0-9]+)"/g)) prints.push(pk(m[1], m[2]))
  const image = /<img class="card shadow[^"]*" src="([^"]+)"/.exec(html)?.[1]

  return {
    name, typeLine, attacks, abilities, rules, text: effect,
    hp: hpPart ? Number(hpPart.replace(/\D/g, '')) : undefined,
    types: types.length ? types : undefined,
    weakness: wr('Weakness'), resistance: wr('Resistance'), retreat,
    regulationMark: mark, prints: [...new Set(prints)], image,
  }
}

// ── 4. tags from Limitless search ───────────────────────────────────────────

async function searchPrints(query: string): Promise<Set<string>> {
  const out = new Set<string>()
  for (let page = 1; ; page++) {
    const { body } = await get(`${LIMITLESS}/cards?q=${encodeURIComponent(query)}&display=list&page=${page}`)
    for (const m of body.matchAll(/href="\/cards\/([A-Z0-9]+)\/([0-9A-Za-z]+)"/g)) out.add(`${m[1]}-${m[2]}`)
    const max = Number(/<ul class="pagination" data-current="\d+" data-max="(\d+)"/.exec(body)?.[1] ?? 1)
    if (page >= max) return out
  }
}

// ── merge ───────────────────────────────────────────────────────────────────

const OWNERS = ["N's", "Team Rocket's", "Ethan's", "Cynthia's", "Marnie's", "Lillie's", "Hop's", "Misty's", "Steven's", "Arven's", "Iono's", "Larry's", "Erika's", "Brock's"]

/** Comparison form: case, quotes, accents, symbols and reminder spacing ignored. */
function norm(s: string | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[{}[\]]/g, '')
    .replace(/\s+/g, ' ').replace(/\s+([.,)])/g, '$1').trim().toLowerCase()
}

function damageString(d: string | number | undefined): string {
  return d === undefined ? '' : String(d).replace('x', '×')
}

interface Mismatch { id: string; name: string; field: string; tcgdex: string; limitless: string }

function merge(p: PoolCard, id: string, allPrints: string[], td: TcgdexCard | null, lc: LimitlessCard, tags: { ancient: Set<string>; future: Set<string>; ace: Set<string> }, mismatches: Mismatch[]): CatalogCard {
  const diff = (field: string, a: unknown, b: unknown) => {
    const sa = typeof a === 'string' ? a : JSON.stringify(a)
    const sb = typeof b === 'string' ? b : JSON.stringify(b)
    if (norm(sa) !== norm(sb)) mismatches.push({ id, name: p.name, field, tcgdex: sa, limitless: sb })
  }
  const prints = [...new Set([id, ...allPrints])]
  const stageOf = (s: string | undefined) => s?.replace(/^Stage(\d)$/, 'Stage $1')
  const tagged = (set: Set<string>) => prints.some(pr => set.has(pr))
  const cardTags: string[] = []
  const owner = OWNERS.find(o => p.name.startsWith(o + ' '))
  if (owner && p.kind === 'pokemon') cardTags.push(owner)

  if (p.kind === 'pokemon') {
    const stage = lc.typeLine[1] as CatalogCard['subtype']
    // Limitless is the source for Pokémon: TCGdex's newest sets carry HTML,
    // misfiled attacks and missing weaknesses. TCGdex only fills gaps.
    const tdAttacks = (td?.attacks ?? []).map(a => ({ name: a.name, cost: (a.cost ?? []) as EnergyType[], damage: damageString(a.damage), text: clean(a.effect) }))
    const tdAbilities = (td?.abilities ?? []).map(a => ({ name: a.name, text: clean(a.effect) }))
    const fromLimitless = lc.attacks.length + lc.abilities.length > 0
    const attacks: CatalogAttack[] = fromLimitless ? lc.attacks : tdAttacks
    const abilities: CatalogAbility[] = fromLimitless ? lc.abilities : tdAbilities
    if (td) {
      diff('hp', td.hp, lc.hp)
      diff('stage', stageOf(td.stage), stage)
      diff('attacks', tdAttacks.map(a => `${a.cost.join(',')} ${a.name} ${a.damage}: ${a.text}`).join(' | '),
        lc.attacks.map(a => `${a.cost.join(',')} ${a.name} ${a.damage}: ${a.text}`).join(' | '))
      diff('abilities', tdAbilities.map(a => `${a.name}: ${a.text}`).join(' | '), lc.abilities.map(a => `${a.name}: ${a.text}`).join(' | '))
      diff('retreat', td.retreat ?? 0, lc.retreat ?? 0)
      diff('weakness', td.weaknesses?.[0]?.type ?? 'none', lc.weakness?.type ?? 'none')
      diff('resistance', td.resistances?.[0]?.type ?? 'none', lc.resistance?.type ?? 'none')
    } else {
      mismatches.push({ id, name: p.name, field: 'missing', tcgdex: '(not on TCGdex)', limitless: 'used Limitless text' })
    }
    const evolveFrom = lc.typeLine.find(s => s.startsWith('Evolves from '))?.replace('Evolves from ', '') ?? td?.evolveFrom
    if (/ ex$/.test(p.name) || td?.suffix === 'ex') cardTags.push('ex')
    if (/^Mega /.test(p.name) || /^Mega /.test(p.name.replace(/^\S+'s /, ''))) cardTags.push('Mega')
    if (lc.rules.some(r => /^As long as this Pokémon is on your Bench, prevent all damage/.test(r))) cardTags.push('Tera')
    if (tagged(tags.ancient)) cardTags.push('Ancient')
    if (tagged(tags.future)) cardTags.push('Future')
    return {
      id, name: p.name, kind: 'pokemon', subtype: stage,
      hp: lc.hp ?? td?.hp,
      types: (lc.types ?? td?.types) as EnergyType[],
      ...(evolveFrom ? { evolveFrom } : {}),
      attacks, abilities,
      ...(lc.rules.length ? { rules: lc.rules } : {}),
      weakness: lc.weakness,
      resistance: lc.resistance,
      retreat: lc.retreat ?? td?.retreat ?? 0,
      tags: cardTags,
      regulationMark: lc.regulationMark ?? td?.regulationMark,
      ...(td ? { tcgdexId: td.id } : {}),
      prints, lists: p.inLists.size,
    }
  }

  // Trainers and energy keep TCGdex's text: it is the wording of the exact
  // print, where Limitless shows one text for every print of the name.
  if (p.kind === 'trainer') {
    const line = lc.typeLine[1]
    const subtype = line === 'Pokémon Tool' ? 'Tool' : line as CatalogCard['subtype']
    if (!['Supporter', 'Item', 'Tool', 'Stadium'].includes(subtype)) throw new Error(`${id}: trainer subtype "${line}"`)
    if (td) {
      diff('text', clean(td.effect), lc.text)
      diff('trainerType', td.trainerType, subtype)
    } else {
      mismatches.push({ id, name: p.name, field: 'missing', tcgdex: '(not on TCGdex)', limitless: 'used Limitless text' })
    }
    if (tagged(tags.ace) || td?.rarity === 'ACE SPEC Rare') cardTags.push('ACE SPEC')
    return {
      id, name: p.name, kind: 'trainer', subtype,
      text: clean(td?.effect) || lc.text,
      tags: cardTags,
      regulationMark: td?.regulationMark ?? lc.regulationMark,
      ...(td ? { tcgdexId: td.id } : {}),
      prints, lists: p.inLists.size,
    }
  }

  const basic = lc.typeLine[1] === 'Basic Energy'
  if (td && !basic) diff('text', clean(td.effect), lc.text)
  if (tagged(tags.ace) || td?.rarity === 'ACE SPEC Rare') cardTags.push('ACE SPEC')
  return {
    id, name: p.name, kind: 'energy', subtype: basic ? 'Basic' : 'Special',
    ...(basic ? { energyType: p.name.replace(/ Energy$/, '') as EnergyType } : { text: clean(td?.effect) || lc.text }),
    tags: cardTags,
    regulationMark: td?.regulationMark ?? lc.regulationMark,
    ...(td ? { tcgdexId: td.id } : {}),
    prints, lists: p.inLists.size,
  }
}

// ── main ────────────────────────────────────────────────────────────────────

interface Merged extends PoolCard {
  /** Every print known for the card: its pages' print tables plus the lists. */
  prints: Set<string>
}

/** Pokémon groups that share a print are one card (one text); trainers and energy are already one per name. */
function mergeByPrints(groups: PoolCard[], printsOf: Map<PoolCard, Set<string>>): Merged[] {
  const parent = groups.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const owner = new Map<string, number>()
  for (const [i, g] of groups.entries()) {
    if (g.kind !== 'pokemon') continue
    for (const pr of printsOf.get(g)!) {
      const j = owner.get(pr)
      if (j === undefined) owner.set(pr, i)
      else parent[find(i)] = find(j)
    }
  }
  const out = new Map<number, Merged>()
  for (const [i, g] of groups.entries()) {
    const root = find(i)
    const m = out.get(root)
    if (!m) {
      out.set(root, { ...g, printsSeen: new Map(g.printsSeen), inLists: new Set(g.inLists), prints: new Set(printsOf.get(g)) })
      continue
    }
    for (const [pr, n] of g.printsSeen) m.printsSeen.set(pr, (m.printsSeen.get(pr) ?? 0) + n)
    for (const l of g.inLists) m.inLists.add(l)
    for (const pr of printsOf.get(g)!) m.prints.add(pr)
  }
  return [...out.values()]
}

/** Image URLs as `prefix index:rest`, the prefix being everything up to the last slash. */
function imageCodec() {
  const prefixes: string[] = []
  const index = new Map<string, number>()
  return {
    prefixes,
    encode(url: string): string {
      const cut = url.lastIndexOf('/') + 1
      const prefix = url.slice(0, cut)
      let i = index.get(prefix)
      if (i === undefined) { i = prefixes.length; prefixes.push(prefix); index.set(prefix, i) }
      return `${i}:${url.slice(cut)}`
    },
  }
}

async function main() {
  const lists: List[] = []
  for (const t of TOURNAMENTS) {
    const { status, body } = await get(`${LIMITLESS}/tournaments/${t}/decklists`)
    if (status !== 200) throw new Error(`tournament ${t}: HTTP ${status}`)
    const found = parseLists(body, t)
    console.log(`tournament ${t}: ${found.length} lists`)
    lists.push(...found)
  }
  const groups = buildPool(lists)
  console.log(`${lists.length} lists, ${groups.length} first-pass cards`)

  const previousFile = join(OUT, 'cards.json')
  const previous: CatalogCard[] = existsSync(previousFile) ? JSON.parse(readFileSync(previousFile, 'utf8')) : []
  const previousIds = new Set(previous.map(c => c.id))

  const tags = {
    ancient: await searchPrints('is:ancient'),
    future: await searchPrints('is:future'),
    ace: await searchPrints('is:ace'),
  }
  console.log(`tags: ${tags.ancient.size} ancient, ${tags.future.size} future, ${tags.ace.size} ACE SPEC prints`)

  const pages = new Map<string, LimitlessCard>()
  const page = async (print: string): Promise<LimitlessCard> => {
    let lc = pages.get(print)
    if (!lc) {
      const [code, number] = splitPrint(print)
      const res = await get(`${LIMITLESS}/cards/${code}/${number}`)
      if (res.status !== 200) throw new Error(`${print}: Limitless page ${res.status}`)
      pages.set(print, lc = parseLimitlessCard(res.body))
    }
    return lc
  }

  const printsOf = new Map<PoolCard, Set<string>>()
  for (const [i, g] of groups.entries()) {
    const lc = await page(mainPrint(g))
    printsOf.set(g, new Set([...lc.prints, ...g.printsSeen.keys()]))
    if ((i + 1) % 50 === 0) console.log(`  pages ${i + 1}/${groups.length}`)
  }
  const pool = mergeByPrints(groups, printsOf)
  console.log(`${pool.length} cards after merging Pokémon by prints`)

  const cards: CatalogCard[] = []
  const mismatches: Mismatch[] = []
  const idConflicts: string[] = []
  const missingImages: string[] = []
  /** Exact-print TCGdex images. */
  const ownImage = new Map<string, string>()
  const imageSource = { tcgdex: 0, otherPrint: 0, limitless: 0, swsh: 0 }
  for (const [i, p] of pool.entries()) {
    const existing = [...p.prints].filter(pr => previousIds.has(pr))
    if (existing.length > 1) idConflicts.push(`${p.name}: ${existing.join(', ')} are now one card`)
    const id = existing[0] ?? mainPrint(p)
    const lc = await page(id)
    if (lc.name !== p.name) mismatches.push({ id, name: p.name, field: 'name', tcgdex: p.name, limitless: lc.name })
    const basic = p.kind === 'energy' && lc.typeLine[1] === 'Basic Energy'
    const td = basic ? null : await fetchTcgdex(id)
    const card = merge(p, id, [...p.prints, ...lc.prints], td, lc, tags, mismatches)

    let image: string | undefined
    if (basic) {
      image = await basicEnergyImage(card.name)
      if (image) imageSource.swsh++
    } else {
      for (const pr of card.prints) {
        const img = await printImage(pr)
        if (img) ownImage.set(pr, img)
      }
      const other = card.prints.map(pr => ownImage.get(pr)).find(Boolean)
      image = ownImage.get(id) ?? other ?? lc.image
      if (ownImage.has(id)) imageSource.tcgdex++
      else if (other) imageSource.otherPrint++
      else if (lc.image) imageSource.limitless++
    }
    if (image) card.image = image
    else missingImages.push(`${card.name} (${id})`)
    cards.push(card)
    if ((i + 1) % 25 === 0) console.log(`  cards ${i + 1}/${pool.length}`)
  }

  const order: Record<CardKind, number> = { pokemon: 0, trainer: 1, energy: 2 }
  cards.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  // Aliases: every same-text print, plus its TCGdex id where the set maps.
  // prints.json carries the same keys for the main app, with each print's art.
  const aliases: Aliases = {}
  const conflicts: string[] = []
  const codec = imageCodec()
  const printsOut: Record<string, string | [string, string]> = {}
  const byId = new Map(cards.map(c => [c.id, c]))
  const alias = (key: string, id: string, image?: string) => {
    if (aliases[key] && aliases[key] !== id) { conflicts.push(`${key}: ${aliases[key]} vs ${id}`); return }
    aliases[key] = id
    const canonical = byId.get(id)!.image
    printsOut[key] = image && image !== canonical ? [id, codec.encode(image)] : id
  }
  for (const c of cards) {
    for (const pr of c.prints) {
      alias(pr, c.id, ownImage.get(pr))
      for (const tid of await tcgdexIds(pr)) alias(tid, c.id, ownImage.get(pr))
    }
    if (c.tcgdexId) alias(c.tcgdexId, c.id, ownImage.get(c.id))
  }
  const names: Record<string, string> = {}
  for (const c of cards) if (c.kind !== 'pokemon') names[normalizeName(c.name)] = c.id
  const images: Record<string, string> = {}
  for (const c of cards) if (c.image) images[c.id] = codec.encode(c.image)
  const sorted = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  const printsJson = { prefixes: codec.prefixes, images: sorted(images), prints: sorted(printsOut), names: sorted(names) }

  const count = (pred: (c: CatalogCard) => boolean) => cards.filter(pred).length
  const totals = {
    pokemon: count(c => c.kind === 'pokemon'),
    Supporter: count(c => c.subtype === 'Supporter'),
    Item: count(c => c.subtype === 'Item'),
    Tool: count(c => c.subtype === 'Tool'),
    Stadium: count(c => c.subtype === 'Stadium'),
    'Basic Energy': count(c => c.kind === 'energy' && c.subtype === 'Basic'),
    'Special Energy': count(c => c.kind === 'energy' && c.subtype === 'Special'),
  }

  // Fixture decks: the best LAIC list of each archetype.
  const laic = lists.filter(l => l.tournament === FIXTURE_TOURNAMENT)
  const archetypes: Record<string, number> = {}
  for (const l of laic) archetypes[l.archetype] = (archetypes[l.archetype] ?? 0) + 1
  const fixtures: FixtureDeck[] = []
  for (const name of Object.keys(archetypes)) {
    const best = laic.filter(l => l.archetype === name).sort((a, b) => a.placing - b.placing)[0]
    fixtures.push({
      archetype: name, placing: best.placing,
      cards: best.cards.map(c => ({ count: c.count, name: c.name, set: c.set, number: c.number, kind: c.kind })),
    })
  }
  fixtures.sort((a, b) => archetypes[b.archetype] - archetypes[a.archetype] || a.archetype.localeCompare(b.archetype))

  const tournamentUrl = (t: number) => `${LIMITLESS}/tournaments/${t}`
  const stats = {
    tournaments: TOURNAMENTS.map(tournamentUrl),
    fixtureTournament: tournamentUrl(FIXTURE_TOURNAMENT),
    lists: lists.length,
    fixtureLists: laic.length,
    total: cards.length,
    pokemonNames: new Set(cards.filter(c => c.kind === 'pokemon').map(c => c.name)).size,
    totals,
    newCards: cards.filter(c => !previousIds.has(c.id)).length,
    archetypes: Object.fromEntries(Object.entries(archetypes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  }

  const ids = new Set(cards.map(c => c.id))
  const lost = [...previousIds].filter(id => !ids.has(id))
  const trainers = cards.filter(c => c.kind === 'trainer')
  const reprinted = trainers.filter(c => c.prints.length > 1).length / trainers.length

  const report = [
    '# Catalog build report',
    '',
    `Generated by \`make catalog\` from Limitless tournaments ${TOURNAMENTS.join(', ')} (${lists.length} lists; fixture decks from ${FIXTURE_TOURNAMENT}), Limitless card pages and TCGdex.`,
    `${cards.length} cards (${stats.newCards} new), ${Object.keys(printsOut).length} print keys, ${mismatches.length} TCGdex vs Limitless differences, ${conflicts.length} alias conflicts, ${lost.length} lost ids.`,
    `Images: ${imageSource.tcgdex} from the card's own print on TCGdex, ${imageSource.otherPrint} from another print, ${imageSource.limitless} from Limitless, ${imageSource.swsh} basic energy from \`swsh\`. ${Math.round(reprinted * 100)}% of trainers have more than one print.`,
    '',
    'Differences are listed for manual review before cards are implemented. The catalog takes Pokémon from Limitless and trainer / energy text from TCGdex (the exact print\'s wording), each falling back to the other.',
    '',
    ...(lost.length ? ['## Lost ids', '', ...lost.map(c => `- ${c}`), ''] : []),
    ...(idConflicts.length ? ['## Merged ids', '', ...idConflicts.map(c => `- ${c}`), ''] : []),
    ...(conflicts.length ? ['## Alias conflicts', '', ...conflicts.map(c => `- ${c}`), ''] : []),
    ...(missingImages.length ? ['## Missing images', '', ...missingImages.map(c => `- ${c}`), ''] : []),
    '## Text differences',
    '',
    ...mismatches.flatMap(m => [`### ${m.name} (${m.id}): ${m.field}`, '', `- TCGdex: ${m.tcgdex}`, `- Limitless: ${m.limitless}`, '']),
  ].join('\n')

  console.log('totals', totals, `pokemon names: ${stats.pokemonNames}, new cards: ${stats.newCards}`)
  console.log(`${mismatches.length} differences, ${conflicts.length} alias conflicts, ${lost.length} lost ids → ${REPORT}`)
  writeFileSync(REPORT, report + '\n')
  const problems = [
    ...(lost.length && !ACCEPT ? [`${lost.length} existing ids disappeared (${lost.join(', ')}); rerun with --accept to write anyway`] : []),
    ...(missingImages.length ? [`${missingImages.length} cards have no image`] : []),
    ...(reprinted < MIN_REPRINTED_TRAINERS ? [`only ${Math.round(reprinted * 100)}% of trainers have a second print: print discovery is broken`] : []),
  ]
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }

  mkdirSync(join(OUT, 'fixtures'), { recursive: true })
  writeFileSync(join(OUT, 'cards.json'), JSON.stringify(cards, null, 1) + '\n')
  writeFileSync(join(OUT, 'aliases.json'), JSON.stringify(sorted(aliases), null, 1) + '\n')
  writeFileSync(PRINTS, JSON.stringify(printsJson) + '\n')
  writeFileSync(join(OUT, 'fixtures/decks.json'), JSON.stringify(fixtures, null, 1) + '\n')
  writeFileSync(join(OUT, 'fixtures/pool-stats.json'), JSON.stringify(stats, null, 1) + '\n')
  console.log(`wrote ${cards.length} cards, ${Object.keys(aliases).length} aliases, ${fixtures.length} fixture decks`)
}

main().catch(err => { console.error(err); process.exit(1) })
