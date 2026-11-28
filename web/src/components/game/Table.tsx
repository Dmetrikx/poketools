import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCardImages } from '@/hooks/useCardImages'
import { useGame } from '@/hooks/useGame'
import { benchLimit, findSlot, other, slotName } from '@/game/engine/rules'
import type { Action, PlayerId } from '@/game/engine/types'
import { deckSignature } from '@/practice/deal'
import type { CardEntry, Deck } from '@/types/deck'
import ActionPopover, { choicePop, sourcePop, type Pop, type Rect } from './ActionPopover'
import { BoardContext, useBoard, type Board, type Hit } from './board'
import Card from './Card'
import GameLog from './GameLog'
import Hand from './Hand'
import JudgePanel from './JudgePanel'
import { viewer } from './perspective'
import Playmat from './Playmat'
import PokemonInPlay from './PokemonInPlay'
import PromptLayer from './PromptLayer'
import { answersOnClick, canAdd, placement, toggle } from './promptPicks'
import type { ResolvedDeck } from './resolveDeck'
import { dropTargets, sameSource, tableActions, type Source } from './targets'
import { useDrag } from './useDrag'
import { makeView, useView, ViewContext } from './view'
import ZoneViewer from './ZoneViewer'
import { DeckPile, DiscardPile, PrizePile, Resolving, StadiumSlot } from './Zones'
import marks from './marks.module.css'
import ui from './ui.module.css'
import styles from './Table.module.css'

interface Props {
  a: Deck
  b: Deck
  ra: ResolvedDeck
  rb: ResolvedDeck
}

type ZoneView = { player: PlayerId; zone: 'discard' | 'deck' }

const CURTAIN_KEY = 'matchup-curtain'

function useStoredFlag(key: string): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try { return localStorage.getItem(key) === '1' } catch { return false }
  })
  const set = useCallback((next: boolean) => {
    setV(next)
    try { localStorage.setItem(key, next ? '1' : '0') } catch { /* unavailable */ }
  }, [key])
  return [v, set]
}

const toRect = (el: HTMLElement): Rect => el.getBoundingClientRect()
const pointRect = (x: number, y: number): Rect => ({ left: x, top: y, width: 0, height: 0 })

/** The matchup table: full viewport, the player who has to act at the bottom. */
export default function Table({ a, b, ra, rb }: Props) {
  const navigate = useNavigate()
  const key = `matchup-${a.id}-${b.id}`
  const signatures = useMemo<[string, string]>(() => [deckSignature(a.entries ?? []), deckSignature(b.entries ?? [])], [a, b])
  const decks = useMemo<[string[], string[]]>(() => [ra.cardIds, rb.cardIds], [ra, rb])
  const entries = useMemo<CardEntry[]>(() => [...ra.entries, ...rb.entries], [ra, rb])
  const allEntries = useMemo(() => [...(a.entries ?? []), ...(b.entries ?? [])], [a, b])
  const [imageMap] = useCardImages(allEntries)
  const g = useGame(key, signatures, decks)
  const s = g.state
  const prompt = g.prompt
  const legal = g.legal

  const names = useMemo<[string, string]>(() => [a.name, b.name === a.name ? `${b.name} (2)` : b.name], [a.name, b.name])
  const me = viewer(s)
  const them = other(me)
  const view = useMemo(() => makeView(s, entries, imageMap, names, me), [s, entries, imageMap, names, me])

  const [selection, setSelection] = useState<Source | null>(null)
  const [pop, setPop] = useState<Pop | null>(null)
  const [judge, setJudge] = useState(false)
  const [zone, setZone] = useState<ZoneView | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [showBoth, setShowBoth] = useState(false)
  const [menu, setMenu] = useState(false)
  const [curtainOn, setCurtainOn] = useStoredFlag(CURTAIN_KEY)
  const [revealed, setRevealed] = useState<PlayerId>(me)

  // Whatever was picked up belongs to the state it was picked up in.
  useEffect(() => { setSelection(null); setPop(null) }, [g.version])
  useEffect(() => { if (!curtainOn) setRevealed(me) }, [curtainOn, me])
  const curtain = curtainOn && revealed !== me && s.phase !== 'over'

  const canAct = s.phase === 'main' && !prompt
  const live = canAct && !judge

  const clear = useCallback(() => { setSelection(null); setPop(null) }, [])
  const act = (x: Action) => { clear(); g.act(x) }
  /** One action goes straight through; several become a choice. */
  const fire = (acts: Action[], rect: Rect, title: string) => {
    if (acts.length === 1) act(acts[0])
    else setPop(choicePop(view, acts, rect, title))
  }
  const openSource = (src: Source, el: HTMLElement) => {
    setSelection(src)
    setPop(sourcePop(view, legal, src, toRect(el)))
  }

  const { drag, bind } = useDrag({
    onStart: () => clear(),
    onDrop: (src, z, x, y) => {
      const acts = z ? dropTargets(s, legal, src).get(z) : undefined
      if (acts) fire(acts, pointRect(x, y), z?.startsWith('slot:') ? targetName(Number(z.slice(5))) : 'Play')
    },
  })
  const targetName = (id: number) => {
    const f = findSlot(view.ctx, id)
    return f ? slotName(view.ctx, f.slot) : 'Pokémon'
  }

  const holding = drag?.src ?? (live ? selection : null)
  const targets = useMemo(() => (live && holding ? dropTargets(s, legal, holding) : null), [live, holding, s, legal])
  const dragFrom = (src: Source, uid: number) => {
    const zones = dropTargets(s, legal, src)
    return zones.size ? bind(src, uid, new Set(zones.keys())) : undefined
  }

  // ── prompt picks (reset with every new state) ──────────────────────────
  const place = prompt ? placement(prompt, s) : null
  const [pk, setPk] = useState<{ v: number; picks: number[]; counts: number[] }>({ v: -1, picks: [], counts: [] })
  const fresh = pk.v === g.version ? pk : { v: g.version, picks: [], counts: prompt?.kind === 'distribute' ? prompt.options.map(() => 0) : [] }
  const setPicks = (picks: number[]) => setPk({ ...fresh, picks })
  const setCounts = (counts: number[]) => setPk({ ...fresh, counts })
  const { picks, counts } = fresh

  // ── what each piece of the board shows and does ────────────────────────
  const board: Board = {
    slot(id): Hit {
      if (prompt) {
        if (place !== 'board') return place === 'hand' ? { dim: true } : {}
        if (prompt.kind === 'choosePokemon') {
          if (!prompt.options.includes(id)) return { dim: true }
          const picked = picks.includes(id)
          return {
            glow: !picked, picked,
            onClick: () => (answersOnClick(prompt) ? g.answer([id]) : setPicks(toggle(picks, id, prompt.max))),
          }
        }
        if (prompt.kind === 'distribute') {
          const i = prompt.options.indexOf(id)
          if (i < 0) return { dim: true }
          const bump = (d: number) => () => setCounts(counts.map((n, j) => (j === i ? n + d : n)))
          return {
            glow: true,
            badge: counts[i] ? String(counts[i]) : undefined,
            stepper: { value: counts[i], inc: canAdd(prompt, counts, i) ? bump(1) : undefined, dec: counts[i] ? bump(-1) : undefined },
            onClick: canAdd(prompt, counts, i) ? bump(1) : undefined,
          }
        }
        return {}
      }
      if (judge) {
        return { selected: selection?.kind === 'slot' && selection.id === id, onClick: () => setSelection({ kind: 'slot', id }) }
      }
      if (!live) return {}
      const f = findSlot(view.ctx, id)
      if (!f) return {}
      const self: Source = { kind: 'slot', id }
      const mine = f.player === s.turnPlayer
      const onPointerDown = mine && f.active ? dragFrom(self, f.slot.stack[f.slot.stack.length - 1]) : undefined
      if (holding && targets) {
        const acts = targets.get(`slot:${id}`)
        if (acts) return { glow: true, onClick: el => fire(acts, toRect(el), slotName(view.ctx, f.slot)) }
        if (sameSource(holding, self)) return { selected: true, onClick: clear, onPointerDown }
      }
      if (!mine) return { dim: !!holding }
      return { dim: !!holding, onClick: el => openSource(self, el), onPointerDown }
    },

    hand(uid): Hit {
      if (prompt) {
        if (place !== 'hand' || prompt.kind !== 'chooseCards') return place === 'board' ? { dim: true } : {}
        if (!prompt.options.includes(uid)) return { dim: true }
        const picked = picks.includes(uid)
        return {
          glow: !picked, picked,
          onClick: () => (answersOnClick(prompt) ? g.answer([uid]) : setPicks(toggle(picks, uid, prompt.max))),
        }
      }
      if (judge) {
        return { selected: selection?.kind === 'hand' && selection.uid === uid, onClick: () => setSelection({ kind: 'hand', uid }) }
      }
      if (!live) return {}
      const self: Source = { kind: 'hand', uid }
      const onPointerDown = dragFrom(self, uid)
      if (sameSource(holding, self)) return { selected: true, onClick: clear, onPointerDown }
      return { dim: !!holding, onClick: el => openSource(self, el), onPointerDown }
    },

    zone(kind): Hit {
      if (!live) return {}
      if (holding && targets) {
        const acts = targets.get(kind)
        return acts ? { glow: true, over: drag?.over === kind, onClick: el => fire(acts, toRect(el), kind === 'bench' ? 'Bench' : 'Stadium') } : {}
      }
      if (kind === 'stadium' && s.stadium !== null) {
        const use = legal.find(x => x.type === 'stadiumAction')
        if (use) return { glow: false, onClick: el => setPop(choicePop(view, [use], toRect(el), view.card(s.stadium!).name)) }
      }
      return {}
    },
  }

  // Drag-over glow for Pokémon targets (the slot hook above can't see the pointer).
  const boardWithDrag: Board = drag
    ? { ...board, slot: id => ({ ...board.slot(id), over: drag.over === `slot:${id}` }) }
    : board

  // ── keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pop || selection) clear()
      else if (zone) setZone(null)
      else if (menu) setMenu(false)
      else if (showLog) setShowLog(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pop, selection, zone, menu, showLog, clear])

  const buttons = canAct ? tableActions(legal) : []
  const onlyEnd = legal.length === 1 && legal[0].type === 'endTurn'
  const status = s.phase === 'setup' ? 'Setup' : s.phase === 'over' ? 'Game over' : `Turn ${s.turn}`

  return (
    <ViewContext.Provider value={view}>
      <BoardContext.Provider value={boardWithDrag}>
        <div className={styles.root} onClick={() => { clear(); setMenu(false) }}>
          <header className={styles.bar} onClick={e => e.stopPropagation()}>
            <button className={ui.ghost} onClick={() => navigate('/play')}>← Decks</button>
            <button className={ui.secondary} disabled={!g.canUndo} onClick={g.undo}>Undo</button>
            <div className={styles.title}>
              <span className={styles.names}><strong>{names[0]}</strong> <span className={styles.vs}>vs</span> <strong>{names[1]}</strong></span>
              <span className={styles.status}>{status}</span>
            </div>
            <span className={styles.spacer} />
            <button className={showLog ? ui.primary : ui.secondary} aria-pressed={showLog} onClick={() => setShowLog(l => !l)}>Log</button>
            <button className={judge ? ui.primary : ui.secondary} aria-pressed={judge} onClick={() => { setJudge(j => !j); clear() }}>Judge</button>
            <div className={styles.menuWrap}>
              <button className={ui.secondary} aria-haspopup="menu" aria-expanded={menu} aria-label="More" onClick={() => setMenu(m => !m)}>⋯</button>
              {menu && (
                <div className={`${ui.panel} ${styles.menu}`} role="menu">
                  <label className={styles.menuItem}>
                    <input type="checkbox" checked={showBoth} onChange={e => setShowBoth(e.target.checked)} /> Show both hands
                  </label>
                  <label className={styles.menuItem}>
                    <input type="checkbox" checked={curtainOn} onChange={e => setCurtainOn(e.target.checked)} /> Pass-the-device screen
                  </label>
                  <button
                    className={styles.menuItem}
                    disabled={!canAct}
                    onClick={() => { setMenu(false); if (confirm(`Concede this game for ${names[me]}?`)) g.act({ type: 'concede', player: me }) }}
                  >
                    Concede
                  </button>
                  <button className={styles.menuItem} onClick={() => { setMenu(false); if (confirm('Start a new game?')) g.newGame() }}>New game</button>
                </div>
              )}
            </div>
          </header>

          {g.error && <div className={styles.toast} role="alert">{g.error}</div>}
          {prompt && place && (
            <PromptLayer key={g.version} prompt={prompt} place={place} picks={picks} counts={counts} setPicks={setPicks} onAnswer={g.answer} />
          )}

          <Playmat
            turn={s.phase === 'main' ? (s.turnPlayer === me ? 'near' : 'far') : null}
            playTarget={!!drag && !!targets?.has('play')}
            over={drag?.over === 'play'}
          >
            <div key={me} className={styles.grid}>
              <div className={styles.fhand}><Hand player={them} near={false} faceUp={showBoth || s.phase === 'over'} /></div>
              <Side player={them} pos="far" onZone={z => setZone({ player: them, zone: z })} />
              <div className={styles.stadium}><StadiumSlot /></div>
              <div className={styles.center}>
                <Resolving />
                {buttons.map(x => (
                  <button
                    key={x.type}
                    className={`${x.type === 'endTurn' ? styles.endTurn : ui.secondary} ${x.type === 'endTurn' && onlyEnd ? styles.pulse : ''}`}
                    onClick={e => { e.stopPropagation(); act(x) }}
                  >
                    {x.type === 'endTurn' ? 'End turn' : `Use ${s.stadium !== null ? view.card(s.stadium).name : 'Stadium'}`}
                  </button>
                ))}
              </div>
              <Side player={me} pos="near" onZone={z => setZone({ player: me, zone: z })} />
              <div className={styles.nhand}><Hand player={me} near faceUp /></div>
            </div>
          </Playmat>

          {pop && !prompt && <ActionPopover {...pop} onAct={act} onClose={clear} />}

          {drag && (
            <div className={styles.dragGhost} style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h } as CSSProperties}>
              <Card uid={drag.uid} className={styles.ghostCard} />
            </div>
          )}

          {judge && !prompt && s.phase !== 'setup' && (
            <JudgePanel
              slotId={selection?.kind === 'slot' ? selection.id : null}
              handCard={selection?.kind === 'hand' ? selection.uid : null}
              onJudge={op => g.act({ type: 'judge', judge: op })}
              onClose={() => { setJudge(false); clear() }}
            />
          )}
          {showLog && <GameLog onClose={() => setShowLog(false)} />}
          {zone && (
            <ZoneViewer player={zone.player} zone={zone.zone} judge={judge} onJudge={op => g.act({ type: 'judge', judge: op })} onClose={() => setZone(null)} />
          )}
          {curtain && (
            <button className={styles.curtain} onClick={e => { e.stopPropagation(); setRevealed(me) }} autoFocus>
              <strong>{names[me]}</strong>
              <span>{prompt && prompt.player !== s.turnPlayer ? 'has a choice to make' : 'it’s your turn'}</span>
              <small>Pass the device, then tap to continue</small>
            </button>
          )}
        </div>
      </BoardContext.Provider>
    </ViewContext.Provider>
  )
}

interface SideProps {
  player: PlayerId
  pos: 'near' | 'far'
  onZone: (z: 'deck' | 'discard') => void
}

/** One player's prizes, Bench, Active Spot and piles, placed in the table grid. */
function Side({ player, pos, onZone }: SideProps) {
  const v = useView()
  const s = v.state
  const pl = s.players[player]
  const hit = useBoardZone(player)
  const slots = Math.max(5, benchLimit(v.ctx, player), pl.bench.length)
  const empty = Math.max(0, slots - pl.bench.length)
  const isTurn = s.phase === 'main' && s.turnPlayer === player
  const near = pos === 'near'
  const benchClick = hit.onClick

  return (
    <>
      <div className={`${styles.prizes} ${near ? styles.nprizes : styles.fprizes}`}>
        <div className={`${styles.plate} ${isTurn ? styles.plateTurn : ''} ${near ? styles.plateNear : styles.plateFar}`}>
          {v.names[player]}
        </div>
        <PrizePile player={player} />
      </div>
      <div
        className={`${styles.bench} ${near ? styles.nbench : styles.fbench} ${hit.glow ? marks.glow : ''} ${hit.over ? marks.over : ''}`}
        data-drop={s.turnPlayer === player ? 'bench' : undefined}
        style={{ '--bench-scale': Math.min(1, 5 / slots) } as CSSProperties}
        onClick={benchClick ? e => { e.stopPropagation(); benchClick(e.currentTarget) } : undefined}
        aria-label={`${v.names[player]}'s Bench`}
      >
        {pl.bench.map(slot => <PokemonInPlay key={slot.id} slot={slot} active={false} />)}
        {Array.from({ length: empty }, (_, i) => (
          <div
            key={`e${i}`}
            className={styles.emptySlot}
            role={benchClick ? 'button' : undefined}
            tabIndex={benchClick ? 0 : undefined}
            aria-label={benchClick ? 'Play onto the Bench' : undefined}
            onKeyDown={benchClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); benchClick(e.currentTarget) } } : undefined}
          />
        ))}
      </div>
      <div className={`${styles.activeCell} ${near ? styles.nactive : styles.factive}`}>
        {pl.active
          ? <PokemonInPlay slot={pl.active} active />
          : <div className={styles.emptyActive}>Active</div>}
      </div>
      <div className={`${styles.piles} ${near ? styles.npiles : styles.fpiles}`}>
        <DeckPile player={player} onOpen={() => onZone('deck')} />
        <DiscardPile player={player} onOpen={() => onZone('discard')} />
      </div>
    </>
  )
}

/** The Bench drop zone belongs to the turn player only. */
function useBoardZone(player: PlayerId): Hit {
  const v = useView()
  const board = useBoard()
  return v.state.turnPlayer === player ? board.zone('bench') : {}
}
