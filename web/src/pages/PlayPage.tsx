import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionMenu, PlayerSide, type Selection } from '@/components/game/Board'
import GameLog from '@/components/game/GameLog'
import JudgePanel from '@/components/game/JudgePanel'
import MatchupSetup from '@/components/game/MatchupSetup'
import PromptPanel from '@/components/game/PromptPanel'
import { resolveDeck } from '@/components/game/resolveDeck'
import ZoneViewer from '@/components/game/ZoneViewer'
import { fromHandCard, fromSlot } from '@/components/game/labels'
import { makeView, ViewContext } from '@/components/game/view'
import styles from '@/components/game/Game.module.css'
import { useCardImages } from '@/hooks/useCardImages'
import { useDeck } from '@/hooks/useDeck'
import { useGame } from '@/hooks/useGame'
import { deckSignature } from '@/practice/deal'
import type { Action, PlayerId } from '@/game/engine/types'
import type { CardEntry, Deck } from '@/types/deck'

export default function PlayPage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a')
  const b = params.get('b')
  if (!a || !b) return <MatchupSetup initialA={a} onStart={(x, y) => setParams({ a: x, b: y })} />
  return <Loader key={`${a}:${b}`} a={a} b={b} />
}

function Loader({ a, b }: { a: string; b: string }) {
  const deckA = useDeck(a)
  const deckB = useDeck(b)
  if (deckA.loading || deckB.loading) return <p className={styles.muted}>Loading decks…</p>
  if (!deckA.deck || !deckB.deck) return <p className={styles.muted}>Couldn't load both decks.</p>
  return <Ready a={deckA.deck} b={deckB.deck} />
}

function Ready({ a, b }: { a: Deck; b: Deck }) {
  const navigate = useNavigate()
  const ra = useMemo(() => resolveDeck(a.entries ?? []), [a])
  const rb = useMemo(() => resolveDeck(b.entries ?? []), [b])
  if (ra.unsupported.length || rb.unsupported.length) {
    return (
      <div className={styles.setup}>
        <p>These decks have cards outside the LAIC 2026–27 pool.</p>
        <button className={styles.secondary} onClick={() => navigate('/play')}>Choose other decks</button>
      </div>
    )
  }
  return <Table a={a} b={b} ra={ra} rb={rb} />
}

function Table({ a, b, ra, rb }: { a: Deck; b: Deck; ra: ReturnType<typeof resolveDeck>; rb: ReturnType<typeof resolveDeck> }) {
  const navigate = useNavigate()
  const key = `matchup-${a.id}-${b.id}`
  const signatures = useMemo<[string, string]>(() => [deckSignature(a.entries ?? []), deckSignature(b.entries ?? [])], [a, b])
  const decks = useMemo<[string[], string[]]>(() => [ra.cardIds, rb.cardIds], [ra, rb])
  const entries = useMemo<CardEntry[]>(() => [...ra.entries, ...rb.entries], [ra, rb])
  const allEntries = useMemo(() => [...(a.entries ?? []), ...(b.entries ?? [])], [a, b])
  const [imageMap] = useCardImages(allEntries)
  const g = useGame(key, signatures, decks)

  const [selection, setSelection] = useState<Selection>(null)
  const [showBoth, setShowBoth] = useState(false)
  const [judge, setJudge] = useState(false)
  const [zone, setZone] = useState<{ player: PlayerId; zone: 'discard' | 'deck' } | null>(null)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSelection(null)
      setZone(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const names: [string, string] = [a.name, b.name === a.name ? `${b.name} (2)` : b.name]
  const view = makeView(g.state, entries, imageMap, names)
  const s = g.state

  const act = (action: Action) => {
    setSelection(null)
    g.act(action)
  }

  const selected: Action[] = !selection ? [] : g.legal.filter(x =>
    selection.kind === 'hand'
      ? fromHandCard(x, selection.uid)
      : fromSlot(x, selection.id, s.players[s.turnPlayer].active?.id === selection.id))

  const general = g.legal.filter(x => x.type === 'endTurn' || x.type === 'stadiumAction')
  const handUp = (p: PlayerId) => showBoth || (s.phase === 'main' && s.turnPlayer === p) || s.phase === 'over'
  const selectionTitle = !selection ? '' : selection.kind === 'hand'
    ? view.card(selection.uid).name
    : view.card(findTop(s, selection.id) ?? selection.id).name

  return (
    <ViewContext.Provider value={view}>
      <div className={styles.table}>
        <div className={styles.toolbar}>
          <button className={styles.secondary} onClick={() => navigate('/play')}>Decks</button>
          <button className={styles.secondary} disabled={!g.canUndo} onClick={g.undo}>Undo</button>
          <label className={styles.toggle}><input type="checkbox" checked={showBoth} onChange={e => setShowBoth(e.target.checked)} /> Show both hands</label>
          <label className={styles.toggle}><input type="checkbox" checked={judge} onChange={e => setJudge(e.target.checked)} /> Judge</label>
          <button className={styles.secondary} onClick={() => setShowLog(l => !l)}>{showLog ? 'Hide log' : 'Log'}</button>
          <span className={styles.spacer} />
          {s.phase === 'main' && <button className={styles.secondary} onClick={() => confirm('Concede this game?') && g.act({ type: 'concede', player: s.turnPlayer })}>Concede</button>}
          <button className={styles.secondary} onClick={() => confirm('Start a new game?') && g.newGame()}>New game</button>
        </div>

        {g.error && <p className={styles.error}>{g.error}</p>}
        {s.phase === 'over' && (
          <div className={styles.banner}>
            {s.winner === 'draw' ? 'The game is a draw.' : `${names[s.winner as PlayerId]} wins.`}
          </div>
        )}

        <div className={`${styles.board} ${showLog ? styles.withLog : ''}`}>
          <div className={styles.sides}>
            <PlayerSide player={1} top handFaceUp={handUp(1)} selection={selection} onSelect={setSelection} onZone={(player, z) => setZone({ player, zone: z })} />
            <div className={styles.center}>
              <div className={styles.stadium}>
                {s.stadium !== null ? <>Stadium: <strong>{view.card(s.stadium).name}</strong></> : <span className={styles.muted}>No Stadium</span>}
              </div>
              <div className={styles.centerActions}>
                {general.map((x, i) => (
                  <button key={i} className={x.type === 'endTurn' ? styles.primary : styles.secondary} onClick={() => act(x)}>
                    {x.type === 'endTurn' ? 'End turn' : `Use ${s.stadium !== null ? view.card(s.stadium).name : 'Stadium'}`}
                  </button>
                ))}
              </div>
            </div>
            <PlayerSide player={0} handFaceUp={handUp(0)} selection={selection} onSelect={setSelection} onZone={(player, z) => setZone({ player, zone: z })} />
          </div>
          {showLog && <GameLog />}
        </div>

        {selection && !judge && !g.prompt && (
          <ActionMenu title={selectionTitle} actions={selected} onAct={act} onClose={() => setSelection(null)} />
        )}
        {judge && !g.prompt && s.phase === 'main' && (
          <JudgePanel
            slotId={selection?.kind === 'slot' ? selection.id : null}
            handCard={selection?.kind === 'hand' ? selection.uid : null}
            onJudge={op => g.act({ type: 'judge', judge: op })}
            onClose={() => setJudge(false)}
          />
        )}
        {g.prompt && <PromptPanel prompt={g.prompt} onAnswer={g.answer} />}
        {zone && (
          <ZoneViewer player={zone.player} zone={zone.zone} judge={judge} onJudge={op => g.act({ type: 'judge', judge: op })} onClose={() => setZone(null)} />
        )}
      </div>
    </ViewContext.Provider>
  )
}

function findTop(s: ReturnType<typeof useGame>['state'], slotId: number): number | null {
  for (const pl of s.players) {
    for (const slot of pl.active ? [pl.active, ...pl.bench] : pl.bench) {
      if (slot.id === slotId) return slot.stack[slot.stack.length - 1]
    }
  }
  return null
}
