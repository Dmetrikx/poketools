import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useCardImages, imageKey, cardImageUrl } from '@/hooks/useCardImages'
import { decksApi } from '@/api/decks'
import type { CardEntry, DeckSummary } from '@/types/deck'
import type { Hand } from './PracticeHandsPage'
import styles from './HandDetailPage.module.css'

interface LocationState {
  hand: Hand
  entries: CardEntry[]
}

const SECTION_ORDER: Record<string, number> = { pokemon: 0, trainer: 1, energy: 2 }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Board types ─────────────────────────────────────── */

type BoardSlot = { cards: CardEntry[]; damage: number }

type Destination =
  | 'hand' | 'drawn' | 'thinned' | 'deck' | 'next' | 'prize'
  | 'active' | 'bench-0' | 'bench-1' | 'bench-2' | 'bench-3' | 'bench-4'
  | 'bench-5' | 'bench-6' | 'bench-7' | 'stadium' | 'discard'

type GameState = {
  handCards: CardEntry[]
  nextCard: CardEntry | null
  remainingDeck: CardEntry[]
  drawnCards: CardEntry[]
  thinnedCards: CardEntry[]
  prizeCards: CardEntry[]
  boardActive: BoardSlot | null
  boardBench: (BoardSlot | null)[]
  boardStadium: BoardSlot | null
  benchSize: 5 | 8
  discardCards: CardEntry[]
}

type DragSource =
  | { zone: 'hand'; index: number }
  | { zone: 'drawn'; index: number }
  | { zone: 'thinned'; index: number }
  | { zone: 'next' }
  | { zone: 'prize'; index: number }
  | { zone: 'active' }
  | { zone: 'bench'; slotIndex: number }
  | { zone: 'discard'; index: number }
  | { zone: 'active-energy'; energyIndex: number }
  | { zone: 'bench-energy'; slotIndex: number; energyIndex: number }
  | { zone: 'stadium' }

/* ── Helpers ─────────────────────────────────────────── */

function addToSlot(slot: BoardSlot | null, card: CardEntry): BoardSlot {
  if (!slot) return { cards: [card], damage: 0 }
  return { ...slot, cards: [...slot.cards, card] }
}

function removeAt<T>(arr: T[], i: number): T[] {
  return [...arr.slice(0, i), ...arr.slice(i + 1)]
}

function totalBoardCards(g: GameState): number {
  return (g.boardActive?.cards.length ?? 0) +
    g.boardBench.reduce((n, s) => n + (s?.cards.length ?? 0), 0) +
    (g.boardStadium?.cards.length ?? 0)
}

/** Place card(s) into any destination zone. */
function placeCards(state: GameState, cards: CardEntry[], dest: Destination): GameState {
  switch (dest) {
    case 'hand':
      return { ...state, handCards: [...state.handCards, ...cards] }
    case 'drawn':
      return { ...state, drawnCards: [...state.drawnCards, ...cards] }
    case 'thinned':
      return { ...state, thinnedCards: [...state.thinnedCards, ...cards] }
    case 'deck':
      return { ...state, remainingDeck: shuffle([...state.remainingDeck, ...cards]) }
    case 'next': {
      const extras = state.nextCard ? [state.nextCard, ...cards.slice(1)] : cards.slice(1)
      return {
        ...state,
        nextCard: cards[0],
        remainingDeck: extras.length > 0 ? shuffle([...state.remainingDeck, ...extras]) : state.remainingDeck,
      }
    }
    case 'prize':
      return { ...state, prizeCards: [...state.prizeCards, ...cards] }
    case 'discard':
      return { ...state, discardCards: [...state.discardCards, ...cards] }
    case 'active': {
      let s = state
      for (const card of cards) s = { ...s, boardActive: addToSlot(s.boardActive, card) }
      return s
    }
    case 'stadium': {
      let s = state
      for (const card of cards) s = { ...s, boardStadium: addToSlot(s.boardStadium, card) }
      return s
    }
    default: {
      const idx = parseInt(dest.split('-')[1])
      let s = state
      for (const card of cards) {
        const bench = [...s.boardBench]
        bench[idx] = addToSlot(bench[idx], card)
        s = { ...s, boardBench: bench }
      }
      return s
    }
  }
}

function boardKeyOf(source: DragSource): string | null {
  if (source.zone === 'active') return 'active'
  if (source.zone === 'bench') return `bench-${source.slotIndex}`
  if (source.zone === 'stadium') return 'stadium'
  return null
}

function isBoardDest(dest: Destination): boolean {
  return dest === 'active' || dest.startsWith('bench-') || dest === 'stadium'
}

function getBoardSlot(state: GameState, key: string): BoardSlot | null {
  if (key === 'active') return state.boardActive
  if (key === 'stadium') return state.boardStadium
  if (key.startsWith('bench-')) return state.boardBench[parseInt(key.split('-')[1])]
  return null
}

function setBoardSlot(state: GameState, key: string, slot: BoardSlot | null): GameState {
  if (key === 'active') return { ...state, boardActive: slot }
  if (key === 'stadium') return { ...state, boardStadium: slot }
  if (key.startsWith('bench-')) {
    const idx = parseInt(key.split('-')[1])
    const bench = [...state.boardBench]
    bench[idx] = slot
    return { ...state, boardBench: bench }
  }
  return state
}

const EMPTY_GAME: GameState = {
  handCards: [],
  nextCard: null,
  remainingDeck: [],
  drawnCards: [],
  thinnedCards: [],
  prizeCards: [],
  boardActive: null,
  boardBench: [null, null, null, null, null],
  boardStadium: null,
  benchSize: 5,
  discardCards: [],
}

/* ── Hand generation ─────────────────────────────────── */

function generateValidHand(entries: CardEntry[]): Hand {
  if (entries.length < 14) {
    const pool = entries.flatMap(e => Array(e.count).fill(e))
    const s = shuffle(pool)
    return {
      hand: s.slice(0, Math.min(7, s.length)),
      prizes: s.slice(7, Math.min(13, s.length)),
      nextCard: s[13] ?? s[0] ?? entries[0],
      remainingDeck: s.slice(14),
      mulligans: 0,
    }
  }

  const pool: CardEntry[] = entries.flatMap(e => Array(e.count).fill(e))
  let shuffled: CardEntry[] = []
  let hand: CardEntry[] = []
  let prizes: CardEntry[] = []
  let mulligans = 0
  let valid = false

  while (!valid && mulligans < 500) {
    shuffled = shuffle([...pool])
    hand = shuffled.slice(0, 7)
    prizes = shuffled.slice(7, 13)
    if (hand.some(c => c.section === 'pokemon')) {
      valid = true
    } else {
      mulligans++
    }
  }

  return {
    hand,
    prizes,
    nextCard: shuffled[13],
    remainingDeck: shuffled.slice(14),
    mulligans,
  }
}

/* ── useGameState hook ───────────────────────────────── */

function useGameState(initial: GameState) {
  const [{ current: game, history }, setStates] = useState<{ current: GameState; history: GameState[] }>(() => ({
    current: initial,
    history: [],
  }))

  const reset = useCallback((newState: GameState) => {
    setStates({ current: newState, history: [] })
  }, [])

  const apply = useCallback((updater: (prev: GameState) => GameState) => {
    setStates(prev => ({
      history: [...prev.history, prev.current],
      current: updater(prev.current),
    }))
  }, [])

  const handleUndo = useCallback(() => {
    setStates(prev => {
      if (prev.history.length === 0) return prev
      return { history: prev.history.slice(0, -1), current: prev.history[prev.history.length - 1] }
    })
  }, [])

  const handleDraw = useCallback(() => {
    apply(prev => {
      if (prev.remainingDeck.length === 0) return prev
      const [drawn, ...rest] = prev.remainingDeck
      return { ...prev, drawnCards: [...prev.drawnCards, drawn], remainingDeck: rest }
    })
  }, [apply])

  const handleThin = useCallback((index: number) => {
    apply(prev => {
      const card = prev.remainingDeck[index]
      const rest = removeAt(prev.remainingDeck, index)
      return { ...prev, remainingDeck: shuffle(rest), thinnedCards: [...prev.thinnedCards, card] }
    })
  }, [apply])

  /** Unified card movement: any zone to any zone. */
  const moveCard = useCallback((source: DragSource, dest: Destination) => {
    apply(prev => {
      const srcBoardKey = boardKeyOf(source)
      const isEnergySrc = source.zone === 'active-energy' || source.zone === 'bench-energy'

      // Board-to-board (non-energy): swap entire slots
      if (srcBoardKey && isBoardDest(dest) && !isEnergySrc) {
        if (srcBoardKey === dest) return prev
        const srcSlot = getBoardSlot(prev, srcBoardKey)
        const destSlot = getBoardSlot(prev, dest)
        let next = setBoardSlot(prev, srcBoardKey, destSlot)
        next = setBoardSlot(next, dest, srcSlot)
        return next
      }

      // Extract card(s) from source
      let cards: CardEntry[]
      let updated: GameState

      switch (source.zone) {
        case 'hand': {
          const card = prev.handCards[source.index]
          if (!card) return prev
          cards = [card]
          updated = { ...prev, handCards: removeAt(prev.handCards, source.index) }
          break
        }
        case 'drawn': {
          const card = prev.drawnCards[source.index]
          if (!card) return prev
          cards = [card]
          updated = { ...prev, drawnCards: removeAt(prev.drawnCards, source.index) }
          break
        }
        case 'thinned': {
          const card = prev.thinnedCards[source.index]
          if (!card) return prev
          cards = [card]
          updated = { ...prev, thinnedCards: removeAt(prev.thinnedCards, source.index) }
          break
        }
        case 'next': {
          if (!prev.nextCard) return prev
          cards = [prev.nextCard]
          updated = { ...prev, nextCard: null }
          break
        }
        case 'prize': {
          const card = prev.prizeCards[source.index]
          if (!card) return prev
          cards = [card]
          updated = { ...prev, prizeCards: removeAt(prev.prizeCards, source.index) }
          break
        }
        case 'discard': {
          const card = prev.discardCards[source.index]
          if (!card) return prev
          cards = [card]
          updated = { ...prev, discardCards: removeAt(prev.discardCards, source.index) }
          break
        }
        case 'active': {
          if (!prev.boardActive) return prev
          cards = prev.boardActive.cards
          updated = { ...prev, boardActive: null }
          break
        }
        case 'bench': {
          const slot = prev.boardBench[source.slotIndex]
          if (!slot) return prev
          cards = slot.cards
          const bench = [...prev.boardBench]
          bench[source.slotIndex] = null
          updated = { ...prev, boardBench: bench }
          break
        }
        case 'stadium': {
          if (!prev.boardStadium) return prev
          cards = prev.boardStadium.cards
          updated = { ...prev, boardStadium: null }
          break
        }
        case 'active-energy': {
          if (!prev.boardActive) return prev
          const energyIndices = prev.boardActive.cards
            .map((c, i) => c.section === 'energy' ? i : -1)
            .filter(i => i !== -1)
          const actualIndex = energyIndices[source.energyIndex]
          if (actualIndex === undefined) return prev
          cards = [prev.boardActive.cards[actualIndex]]
          const newCards = removeAt(prev.boardActive.cards, actualIndex)
          updated = { ...prev, boardActive: newCards.length > 0 ? { ...prev.boardActive, cards: newCards } : null }
          break
        }
        case 'bench-energy': {
          const bSlot = prev.boardBench[source.slotIndex]
          if (!bSlot) return prev
          const energyIndices = bSlot.cards
            .map((c, i) => c.section === 'energy' ? i : -1)
            .filter(i => i !== -1)
          const actualIndex = energyIndices[source.energyIndex]
          if (actualIndex === undefined) return prev
          cards = [bSlot.cards[actualIndex]]
          const newCards = removeAt(bSlot.cards, actualIndex)
          const bench = [...prev.boardBench]
          bench[source.slotIndex] = newCards.length > 0 ? { ...bSlot, cards: newCards } : null
          updated = { ...prev, boardBench: bench }
          break
        }
        default:
          return prev
      }

      if (!cards.length) return prev
      return placeCards(updated, cards, dest)
    })
  }, [apply])

  const adjustDamage = useCallback((target: 'active' | number, amount: number) => {
    apply(prev => {
      if (target === 'active') {
        if (!prev.boardActive) return prev
        return { ...prev, boardActive: { ...prev.boardActive, damage: Math.max(0, prev.boardActive.damage + amount) } }
      }
      const slot = prev.boardBench[target]
      if (!slot) return prev
      const bench = [...prev.boardBench]
      bench[target] = { ...slot, damage: Math.max(0, slot.damage + amount) }
      return { ...prev, boardBench: bench }
    })
  }, [apply])

  const handleReshuffle = useCallback(() => {
    apply(prev => {
      const toReshuffle = [
        ...prev.handCards,
        ...prev.drawnCards,
        ...prev.thinnedCards,
        ...(prev.nextCard ? [prev.nextCard] : []),
        ...prev.remainingDeck,
      ]
      return {
        ...prev,
        handCards: [],
        drawnCards: [],
        thinnedCards: [],
        nextCard: null,
        remainingDeck: shuffle(toReshuffle),
      }
    })
  }, [apply])

  const handleShuffleToBottom = useCallback(() => {
    apply(prev => {
      const toBottom = shuffle([
        ...prev.handCards,
        ...prev.drawnCards,
        ...prev.thinnedCards,
        ...(prev.nextCard ? [prev.nextCard] : []),
      ])
      return {
        ...prev,
        handCards: [],
        drawnCards: [],
        thinnedCards: [],
        nextCard: null,
        remainingDeck: [...prev.remainingDeck, ...toBottom],
      }
    })
  }, [apply])

  const handleDrawToHand = useCallback((count: number) => {
    apply(prev => {
      const available = Math.min(count, prev.remainingDeck.length)
      if (available === 0) return prev
      const drawn = prev.remainingDeck.slice(0, available)
      return {
        ...prev,
        handCards: [...prev.handCards, ...drawn],
        remainingDeck: prev.remainingDeck.slice(available),
      }
    })
  }, [apply])

  const expandBench = useCallback(() => {
    apply(prev => {
      if (prev.benchSize === 8) return prev
      return { ...prev, benchSize: 8, boardBench: [...prev.boardBench, null, null, null] }
    })
  }, [apply])

  const shrinkBench = useCallback(() => {
    apply(prev => {
      if (prev.benchSize === 5) return prev
      const overflowCards = prev.boardBench.slice(5).flatMap(slot => slot?.cards ?? [])
      return {
        ...prev,
        benchSize: 5,
        boardBench: prev.boardBench.slice(0, 5),
        discardCards: [...prev.discardCards, ...overflowCards],
      }
    })
  }, [apply])

  return {
    game,
    history,
    reset,
    handleUndo,
    handleDraw,
    handleThin,
    moveCard,
    adjustDamage,
    handleReshuffle,
    handleShuffleToBottom,
    handleDrawToHand,
    expandBench,
    shrinkBench,
  }
}

/* ── DragCard wrapper ────────────────────────────────── */

function DragCard({ onDragStart, children }: { onDragStart: () => void; children: React.ReactNode }) {
  return (
    <div
      className={styles.draggableCard}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
    >
      {children}
    </div>
  )
}

/* ── DeckPickerModal ─────────────────────────────────── */

function DeckPickerModal({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    decksApi.list()
      .then(setDecks)
      .catch(() => setDecks([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Select Opponent Deck</span>
          <button className={styles.modalCloseBtn} onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <p className={styles.modalLoading}>Loading decks…</p>
        ) : decks.length === 0 ? (
          <p className={styles.modalLoading}>No decks found.</p>
        ) : (
          <div className={styles.deckPickerList}>
            {decks.map(deck => (
              <button
                key={deck.id}
                className={styles.deckPickerItem}
                onClick={() => onSelect(deck.id)}
              >
                <span className={styles.deckPickerName}>{deck.name}</span>
                <span className={styles.deckPickerFormat}>{deck.format}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────── */

export default function HandDetailPage() {
  const { id, handIndex } = useParams<{ id: string; handIndex: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  // Two independent game states
  const playerGs = useGameState({
    handCards: state?.hand.hand ?? [],
    nextCard: state?.hand.nextCard ?? null,
    remainingDeck: state?.hand.remainingDeck ?? [],
    drawnCards: [],
    thinnedCards: [],
    prizeCards: state?.hand.prizes ?? [],
    boardActive: null,
    boardBench: [null, null, null, null, null],
    boardStadium: null,
    benchSize: 5,
    discardCards: [],
  })
  const opponentGs = useGameState(EMPTY_GAME)

  const [activePlayer, setActivePlayer] = useState<'player' | 'opponent'>('player')
  const [opponentEntries, setOpponentEntries] = useState<CardEntry[]>([])
  const [opponentInfo, setOpponentInfo] = useState<{ deckName: string; mulligans: number; prizes: CardEntry[] } | null>(null)
  const [showDeckPicker, setShowDeckPicker] = useState(false)
  const [loadingOpponent, setLoadingOpponent] = useState(false)

  const [playerImageMap] = useCardImages(state?.entries ?? [])
  const [opponentImageMap] = useCardImages(opponentEntries)

  // Stable refs so keyboard/drop handlers don't go stale
  const activePlayerRef = useRef(activePlayer)
  activePlayerRef.current = activePlayer
  const playerGsRef = useRef(playerGs)
  playerGsRef.current = playerGs
  const opponentGsRef = useRef(opponentGs)
  opponentGsRef.current = opponentGs

  const dragSourceRef = useRef<DragSource | null>(null)
  const [dragOverZone, setDragOverZone] = useState<Destination | null>(null)

  // Keyboard undo — always targets active player's board
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const gs = activePlayerRef.current === 'player' ? playerGsRef.current : opponentGsRef.current
        gs.handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { reset: resetOpponent } = opponentGs

  const handleSelectOpponent = useCallback(async (deckId: string) => {
    setShowDeckPicker(false)
    setLoadingOpponent(true)
    try {
      const deck = await decksApi.get(deckId)
      const entries = deck.entries
      setOpponentEntries(entries)
      const hand = generateValidHand(entries)
      resetOpponent({
        handCards: hand.hand,
        nextCard: hand.nextCard,
        remainingDeck: hand.remainingDeck,
        drawnCards: [],
        thinnedCards: [],
        prizeCards: hand.prizes,
        boardActive: null,
        boardBench: [null, null, null, null, null],
        boardStadium: null,
        benchSize: 5,
        discardCards: [],
      })
      setOpponentInfo({ deckName: deck.name, mulligans: hand.mulligans, prizes: hand.prizes })
      setActivePlayer('opponent')
    } catch (err) {
      console.error('Failed to load opponent deck', err)
    } finally {
      setLoadingOpponent(false)
    }
  }, [resetOpponent])

  const handleDrop = useCallback((dest: Destination) => {
    setDragOverZone(null)
    const src = dragSourceRef.current
    if (!src) return
    dragSourceRef.current = null
    const gs = activePlayerRef.current === 'player' ? playerGsRef.current : opponentGsRef.current
    gs.moveCard(src, dest)
  }, [])

  /* ── Guard: no state ───────────────────────────────── */

  if (!state) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>No hand data. Go back to practice hands and click a hand panel.</p>
        <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}/practice`)}>
          ← Back to Practice Hands
        </button>
      </div>
    )
  }

  // Active player's data
  const activeGs = activePlayer === 'player' ? playerGs : opponentGs
  const activeImageMap = activePlayer === 'player' ? playerImageMap : opponentImageMap
  const { hand } = state
  const handNum = Number(handIndex) + 1
  const { handCards, nextCard, remainingDeck, drawnCards, thinnedCards, prizeCards, boardActive, boardBench, boardStadium, benchSize, discardCards } = activeGs.game

  const sortedWithOriginalIndex = [...remainingDeck]
    .map((card, idx) => ({ card, originalIndex: idx }))
    .sort((a, b) => {
      const sectionDiff = (SECTION_ORDER[a.card.section] ?? 3) - (SECTION_ORDER[b.card.section] ?? 3)
      if (sectionDiff !== 0) return sectionDiff
      return a.card.name.localeCompare(b.card.name)
    })

  const renderCard = (card: CardEntry, className?: string) => {
    const key = imageKey(card)
    const img = activeImageMap.get(key)
    return img ? (
      <img className={className} src={cardImageUrl(img, 'low')} alt={card.name} title={card.name} />
    ) : (
      <div className={styles.cardPlaceholder}>
        <div className={styles.placeholderText}>
          {card.name}<br /><small>{card.setCode}</small>
        </div>
      </div>
    )
  }

  /* ── Drop event helpers ────────────────────────────── */

  const dropHandlers = (dest: Destination) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragOverZone(dest) },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverZone(null)
    },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); handleDrop(dest) },
  })

  /* ── Board slot renderer ───────────────────────────── */

  const renderSlot = (
    slot: BoardSlot | null,
    dest: Destination,
    label: string,
    dragStart: DragSource,
    energyDragStart: (energyIndex: number) => DragSource,
    slotClass: string,
    damageTarget?: 'active' | number,
  ) => {
    const isOver = dragOverZone === dest
    const pokemon = slot?.cards.filter(c => c.section !== 'energy') ?? []
    const energy = slot?.cards.filter(c => c.section === 'energy') ?? []
    const hasPokemon = pokemon.length > 0

    return (
      <div
        className={`${styles.boardSlot} ${slotClass} ${isOver ? styles.boardSlotDropActive : ''} ${slot ? styles.boardSlotOccupied : ''}`}
        {...dropHandlers(dest)}
      >
        {!slot ? (
          <>
            <span className={styles.boardSlotLabel}>{label}</span>
            {isOver && <span className={styles.boardSlotDrop}>Drop</span>}
          </>
        ) : (
          <div className={styles.cardStack}>
            <DragCard onDragStart={() => { dragSourceRef.current = dragStart }}>
              <div className={styles.pokemonStack}>
                {pokemon.map((card, i) => (
                  <div
                    key={i}
                    className={styles.stackedPokemon}
                    style={{ zIndex: i }}
                    title={card.name}
                  >
                    {renderCard(card)}
                  </div>
                ))}
              </div>
            </DragCard>
            {energy.length > 0 && (
              <div className={styles.energyRow}>
                {energy.map((card, i) => (
                  <DragCard key={i} onDragStart={() => { dragSourceRef.current = energyDragStart(i) }}>
                    <div className={styles.energyCard} title={card.name}>
                      {renderCard(card)}
                    </div>
                  </DragCard>
                ))}
              </div>
            )}
            {hasPokemon && damageTarget !== undefined && (
              <div className={styles.damageCounter}>
                <div className={styles.damageButtons}>
                  <button className={styles.damageBtn} onClick={(e) => { e.stopPropagation(); activeGs.adjustDamage(damageTarget, -100) }} title="-100">--</button>
                  <button className={styles.damageBtn} onClick={(e) => { e.stopPropagation(); activeGs.adjustDamage(damageTarget, -10) }} title="-10">-</button>
                </div>
                <span className={`${styles.damageValue} ${slot.damage > 0 ? styles.damageValueActive : ''}`}>{slot.damage}</span>
                <div className={styles.damageButtons}>
                  <button className={`${styles.damageBtn} ${styles.damageBtnAdd}`} onClick={(e) => { e.stopPropagation(); activeGs.adjustDamage(damageTarget, 10) }} title="+10">+</button>
                  <button className={`${styles.damageBtn} ${styles.damageBtnAdd}`} onClick={(e) => { e.stopPropagation(); activeGs.adjustDamage(damageTarget, 100) }} title="+100">++</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const boardCount = totalBoardCards(activeGs.game)
  const activeHistory = activeGs.history
  const activeMulligans = activePlayer === 'player' ? hand.mulligans : (opponentInfo?.mulligans ?? 0)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {opponentInfo && (
            <div className={styles.tabBar}>
              <button
                className={`${styles.tabBtn} ${activePlayer === 'player' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePlayer('player')}
              >
                You
              </button>
              <button
                className={`${styles.tabBtn} ${activePlayer === 'opponent' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePlayer('opponent')}
              >
                Opponent
              </button>
            </div>
          )}
          <h1 className={styles.title}>
            {activePlayer === 'player'
              ? `Hand ${handNum}`
              : opponentInfo?.deckName ?? 'Opponent'
            }
          </h1>
          {activeMulligans > 0 && (
            <span className={styles.mulliganBadge}>
              {activeMulligans} {activeMulligans === 1 ? 'mulligan' : 'mulligans'}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <span className={styles.deckCount}>{remainingDeck.length} in deck</span>
          <button className={styles.reshuffleBtn} onClick={activeGs.handleReshuffle} title="Shuffle all non-boarded, non-discarded cards back into the deck">Reshuffle</button>
          <button className={styles.shuffleBottomBtn} onClick={activeGs.handleShuffleToBottom} title="Shuffle hand and drawn/thinned cards to the bottom of the deck">Shuffle to Bottom</button>
          <button className={styles.drawHandBtn} onClick={() => activeGs.handleDrawToHand(6)} disabled={remainingDeck.length === 0} title="Draw 6 cards to hand">Draw 6</button>
          <button className={styles.drawHandBtn} onClick={() => activeGs.handleDrawToHand(8)} disabled={remainingDeck.length === 0} title="Draw 8 cards to hand">Draw 8</button>
          <button className={styles.undoBtn} onClick={activeGs.handleUndo} disabled={activeHistory.length === 0} title="Undo last action">Undo</button>
          <button
            className={styles.opponentBtn}
            onClick={() => setShowDeckPicker(true)}
            disabled={loadingOpponent}
            title={opponentInfo ? `Currently: ${opponentInfo.deckName}. Click to switch.` : 'Add an opponent deck to practice the matchup'}
          >
            {loadingOpponent ? 'Loading…' : opponentInfo ? 'Switch Deck' : 'Add Opponent'}
          </button>
          <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}/practice`)}>Back</button>
        </div>
      </div>

      {/* Main horizontal row of columns */}
      <div className={styles.mainRow}>

        {/* Column 1: Unified Hand / Drawing / Thinning */}
        <div className={styles.handColumn}>
          <div className={styles.colActionHeader}>
            <span className={styles.colLabel}>
              Hand ({handCards.length + drawnCards.length + thinnedCards.length})
            </span>
            <button className={styles.drawBtn} onClick={activeGs.handleDraw} disabled={remainingDeck.length === 0}>Draw</button>
          </div>
          <div
            className={`${styles.handColumnScroll} ${dragOverZone === 'hand' ? styles.colDropActive : ''}`}
            {...dropHandlers('hand')}
          >
            {/* Hand cards */}
            {handCards.length > 0 && (
              <div className={styles.columnCardGrid}>
                {handCards.map((card, i) => (
                  <DragCard key={`hand-${i}`} onDragStart={() => { dragSourceRef.current = { zone: 'hand', index: i } }}>
                    <div className={styles.columnCardItem}>{renderCard(card)}</div>
                  </DragCard>
                ))}
              </div>
            )}

            {/* Drawn cards */}
            {drawnCards.length > 0 && (
              <>
                <div className={styles.colSubLabel}>Drawn ({drawnCards.length})</div>
                <div className={styles.columnCardGrid}>
                  {drawnCards.map((card, i) => (
                    <DragCard key={`drawn-${i}`} onDragStart={() => { dragSourceRef.current = { zone: 'drawn', index: i } }}>
                      <div className={`${styles.columnCardItem} ${styles.drawnCardEntry}`}>{renderCard(card)}</div>
                    </DragCard>
                  ))}
                </div>
              </>
            )}

            {/* Thinned cards */}
            {thinnedCards.length > 0 && (
              <>
                <div className={styles.colSubLabel}>Thinned ({thinnedCards.length})</div>
                <div className={styles.columnCardGrid}>
                  {thinnedCards.map((card, i) => (
                    <DragCard key={`thinned-${i}`} onDragStart={() => { dragSourceRef.current = { zone: 'thinned', index: i } }}>
                      <div className={`${styles.columnCardItem} ${styles.thinnedCardItem}`}>{renderCard(card)}</div>
                    </DragCard>
                  ))}
                </div>
              </>
            )}

            {/* Remaining deck for thinning */}
            {remainingDeck.length > 0 && (
              <div
                className={`${styles.deckSection} ${dragOverZone === 'deck' ? styles.deckSectionDropActive : ''}`}
                {...dropHandlers('deck')}
              >
                <div className={styles.colSubLabel}>
                  Deck ({remainingDeck.length}) <span className={styles.deckHint}>· click to thin</span>
                </div>
                <div className={styles.deckCardGrid}>
                  {sortedWithOriginalIndex.map(({ card, originalIndex }) => (
                    <div
                      key={originalIndex}
                      className={`${styles.columnCardItem} ${styles.deckCardItem}`}
                      onClick={() => activeGs.handleThin(originalIndex)}
                      title={`Thin ${card.name}`}
                    >
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {handCards.length === 0 && drawnCards.length === 0 && thinnedCards.length === 0 && remainingDeck.length === 0 && (
              <p className={styles.emptyHint}>{dragOverZone === 'hand' ? 'Drop here' : 'Empty'}</p>
            )}
          </div>

          {/* Column 1b: Next card slot — docked to bottom, disappears when empty */}
          {(nextCard !== null || dragOverZone === 'next') && (
            <div
              className={`${styles.nextSlotDocked} ${dragOverZone === 'next' ? styles.nextSlotDropActive : ''}`}
              {...dropHandlers('next')}
            >
              <div className={styles.colSubLabel}>Next</div>
              {nextCard ? (
                <DragCard onDragStart={() => { dragSourceRef.current = { zone: 'next' } }}>
                  <div className={styles.nextCardItem}>{renderCard(nextCard)}</div>
                </DragCard>
              ) : (
                <span className={styles.zoneEmpty}>Drop here</span>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Discard */}
        <div
          className={`${styles.discardColumn} ${dragOverZone === 'discard' ? styles.discardColumnActive : ''}`}
          {...dropHandlers('discard')}
        >
          <div className={styles.colActionHeader}>
            <span className={`${styles.colLabel} ${styles.colLabelDiscard}`}>Discard ({discardCards.length})</span>
          </div>
          <div className={styles.colScrollArea}>
            <div className={styles.columnCardGrid}>
              {discardCards.map((card, i) => (
                <DragCard key={i} onDragStart={() => { dragSourceRef.current = { zone: 'discard', index: i } }}>
                  <div className={styles.columnCardItem}>{renderCard(card)}</div>
                </DragCard>
              ))}
              {discardCards.length === 0 && (
                <p className={styles.emptyHint}>{dragOverZone === 'discard' ? 'Drop here' : 'Drag cards here'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Board — primary visual focus */}
        <div className={styles.boardColumn}>
          <div className={styles.boardHeader}>
            <div className={`${styles.colLabel} ${styles.colLabelBoard}`}>Board ({boardCount})</div>
            <div className={styles.benchSizeControls}>
              <button
                className={styles.benchSizeBtn}
                onClick={activeGs.expandBench}
                disabled={benchSize === 8}
                title="Expand bench to 8 slots"
              >
                Bench 8
              </button>
              <button
                className={styles.benchSizeBtn}
                onClick={activeGs.shrinkBench}
                disabled={benchSize === 5}
                title="Shrink bench to 5 slots (overflow discarded)"
              >
                Bench 5
              </button>
            </div>
          </div>
          <div className={styles.boardLayout}>
            <div className={styles.activeArea}>
              {renderSlot(boardActive, 'active', 'Active', { zone: 'active' }, (ei) => ({ zone: 'active-energy', energyIndex: ei }), styles.activeSlot, 'active')}
              {renderSlot(boardStadium, 'stadium', 'Stadium', { zone: 'stadium' }, (_ei) => ({ zone: 'stadium' }), styles.stadiumSlot)}
            </div>
            <div className={styles.benchArea}>
              {boardBench.map((slot, i) => renderSlot(
                slot,
                `bench-${i}` as Destination,
                'Bench',
                { zone: 'bench', slotIndex: i },
                (ei) => ({ zone: 'bench-energy', slotIndex: i, energyIndex: ei }),
                styles.benchSlot,
                i,
              ))}
            </div>
          </div>
        </div>

        {/* Column 4: Prizes */}
        <div
          className={`${styles.prizesColumn} ${dragOverZone === 'prize' ? styles.prizesColumnActive : ''}`}
          {...dropHandlers('prize')}
        >
          <div className={styles.colActionHeader}>
            <span className={styles.colLabel}>Prizes ({prizeCards.length})</span>
          </div>
          <div className={styles.colScrollArea}>
            <div className={styles.columnCardGrid}>
              {prizeCards.map((card, i) => (
                <DragCard key={i} onDragStart={() => { dragSourceRef.current = { zone: 'prize', index: i } }}>
                  <div className={`${styles.columnCardItem} ${styles.prizeCardItem}`}>{renderCard(card)}</div>
                </DragCard>
              ))}
              {prizeCards.length === 0 && (
                <p className={styles.emptyHint}>{dragOverZone === 'prize' ? 'Drop here' : '—'}</p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Deck picker modal */}
      {showDeckPicker && (
        <DeckPickerModal
          onSelect={handleSelectOpponent}
          onClose={() => setShowDeckPicker(false)}
        />
      )}
    </div>
  )
}