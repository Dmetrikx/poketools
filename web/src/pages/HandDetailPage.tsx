import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useCardImages, imageKey, cardImageUrl } from '@/hooks/useCardImages'
import type { CardEntry } from '@/types/deck'
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

type BoardSlot = { cards: CardEntry[] }

type Destination = 'active' | 'bench-0' | 'bench-1' | 'bench-2' | 'bench-3' | 'bench-4' | 'discard'

type GameState = {
  handCards: CardEntry[]
  nextCard: CardEntry | null
  remainingDeck: CardEntry[]
  drawnCards: CardEntry[]
  thinnedCards: CardEntry[]
  boardActive: BoardSlot | null
  boardBench: (BoardSlot | null)[]
  discardCards: CardEntry[]
}

type DragSource =
  | { zone: 'hand'; index: number }
  | { zone: 'drawn'; index: number }
  | { zone: 'thinned'; index: number }
  | { zone: 'next' }
  | { zone: 'active' }
  | { zone: 'bench'; slotIndex: number }
  | { zone: 'discard'; index: number }

/* ── Helpers ─────────────────────────────────────────── */

function addToSlot(slot: BoardSlot | null, card: CardEntry): BoardSlot {
  if (!slot) return { cards: [card] }
  return { cards: [...slot.cards, card] }
}

function placeCard(state: GameState, card: CardEntry, dest: Destination): GameState {
  if (dest === 'discard') {
    return { ...state, discardCards: [...state.discardCards, card] }
  }
  if (dest === 'active') {
    return { ...state, boardActive: addToSlot(state.boardActive, card) }
  }
  const idx = parseInt(dest.split('-')[1])
  const bench = [...state.boardBench]
  bench[idx] = addToSlot(bench[idx], card)
  return { ...state, boardBench: bench }
}

function removeAt<T>(arr: T[], i: number): T[] {
  return [...arr.slice(0, i), ...arr.slice(i + 1)]
}

function totalBoardCards(g: GameState): number {
  return (g.boardActive?.cards.length ?? 0) +
    g.boardBench.reduce((n, s) => n + (s?.cards.length ?? 0), 0)
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

/* ── Main component ──────────────────────────────────── */

export default function HandDetailPage() {
  const { id, handIndex } = useParams<{ id: string; handIndex: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const [{ current: game, history }, setStates] = useState<{ current: GameState; history: GameState[] }>(() => ({
    current: {
      handCards: state?.hand.hand ?? [],
      nextCard: state?.hand.nextCard ?? null,
      remainingDeck: state?.hand.remainingDeck ?? [],
      drawnCards: [],
      thinnedCards: [],
      boardActive: null,
      boardBench: [null, null, null, null, null],
      discardCards: [],
    },
    history: [],
  }))

  const [imageMap] = useCardImages(state?.entries ?? [])
  const dragSourceRef = useRef<DragSource | null>(null)
  const [dragOverZone, setDragOverZone] = useState<Destination | null>(null)

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo])

  /* ── Actions ───────────────────────────────────────── */

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

  const moveHandCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.handCards[idx]
      if (!card) return prev
      return placeCard({ ...prev, handCards: removeAt(prev.handCards, idx) }, card, dest)
    })
  }, [apply])

  const moveDrawnCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.drawnCards[idx]
      if (!card) return prev
      return placeCard({ ...prev, drawnCards: removeAt(prev.drawnCards, idx) }, card, dest)
    })
  }, [apply])

  const moveThinnedCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.thinnedCards[idx]
      if (!card) return prev
      return placeCard({ ...prev, thinnedCards: removeAt(prev.thinnedCards, idx) }, card, dest)
    })
  }, [apply])

  const moveNextCard = useCallback((dest: Destination) => {
    apply(prev => {
      if (!prev.nextCard) return prev
      return placeCard({ ...prev, nextCard: null }, prev.nextCard, dest)
    })
  }, [apply])

  const moveFromActive = useCallback((dest: Destination) => {
    apply(prev => {
      if (!prev.boardActive) return prev
      if (dest === 'discard') {
        return { ...prev, boardActive: null, discardCards: [...prev.discardCards, ...prev.boardActive.cards] }
      }
      if (dest === 'active') return prev
      // Swap with bench slot
      const benchIdx = parseInt(dest.split('-')[1])
      const bench = [...prev.boardBench]
      const target = bench[benchIdx]
      bench[benchIdx] = prev.boardActive
      return { ...prev, boardActive: target, boardBench: bench }
    })
  }, [apply])

  const moveFromBench = useCallback((slotIdx: number, dest: Destination) => {
    apply(prev => {
      const slot = prev.boardBench[slotIdx]
      if (!slot) return prev
      if (dest === 'discard') {
        const bench = [...prev.boardBench]
        bench[slotIdx] = null
        return { ...prev, boardBench: bench, discardCards: [...prev.discardCards, ...slot.cards] }
      }
      if (dest === 'active') {
        const bench = [...prev.boardBench]
        bench[slotIdx] = prev.boardActive
        return { ...prev, boardActive: slot, boardBench: bench }
      }
      // Bench-to-bench swap
      const targetIdx = parseInt(dest.split('-')[1])
      if (targetIdx === slotIdx) return prev
      const bench = [...prev.boardBench]
      bench[slotIdx] = bench[targetIdx]
      bench[targetIdx] = slot
      return { ...prev, boardBench: bench }
    })
  }, [apply])

  const moveDiscardCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.discardCards[idx]
      if (!card) return prev
      return placeCard({ ...prev, discardCards: removeAt(prev.discardCards, idx) }, card, dest)
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

  /* ── Drop handler ──────────────────────────────────── */

  const handleDrop = useCallback((dest: Destination) => {
    setDragOverZone(null)
    const src = dragSourceRef.current
    if (!src) return
    dragSourceRef.current = null
    switch (src.zone) {
      case 'hand': moveHandCard(src.index, dest); break
      case 'drawn': moveDrawnCard(src.index, dest); break
      case 'thinned': moveThinnedCard(src.index, dest); break
      case 'next': moveNextCard(dest); break
      case 'active': moveFromActive(dest); break
      case 'bench': moveFromBench(src.slotIndex, dest); break
      case 'discard': moveDiscardCard(src.index, dest); break
    }
  }, [moveHandCard, moveDrawnCard, moveThinnedCard, moveNextCard, moveFromActive, moveFromBench, moveDiscardCard])

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

  const { hand } = state
  const handNum = Number(handIndex) + 1
  const { handCards, nextCard, remainingDeck, drawnCards, thinnedCards, boardActive, boardBench, discardCards } = game

  const sortedWithOriginalIndex = [...remainingDeck]
    .map((card, idx) => ({ card, originalIndex: idx }))
    .sort((a, b) => {
      const sectionDiff = (SECTION_ORDER[a.card.section] ?? 3) - (SECTION_ORDER[b.card.section] ?? 3)
      if (sectionDiff !== 0) return sectionDiff
      return a.card.name.localeCompare(b.card.name)
    })

  const renderCard = (card: CardEntry, className?: string) => {
    const key = imageKey(card)
    const img = imageMap.get(key)
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
    slotClass: string,
  ) => {
    const isOver = dragOverZone === dest
    const pokemon = slot?.cards.filter(c => c.section !== 'energy') ?? []
    const energy = slot?.cards.filter(c => c.section === 'energy') ?? []

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
          <DragCard onDragStart={() => { dragSourceRef.current = dragStart }}>
            <div className={styles.cardStack}>
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
              {energy.length > 0 && (
                <div className={styles.energyRow}>
                  {energy.map((card, i) => (
                    <div key={i} className={styles.energyCard} title={card.name}>
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DragCard>
        )}
      </div>
    )
  }

  const boardCount = totalBoardCards(game)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Hand {handNum}</h1>
          {hand.mulligans > 0 && (
            <span className={styles.mulliganBadge}>
              {hand.mulligans} {hand.mulligans === 1 ? 'mulligan' : 'mulligans'}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <span className={styles.deckCount}>{remainingDeck.length} in deck</span>
          <button className={styles.reshuffleBtn} onClick={handleReshuffle} title="Shuffle all non-boarded, non-discarded cards back into the deck">Reshuffle</button>
          <button className={styles.shuffleBottomBtn} onClick={handleShuffleToBottom} title="Shuffle hand and drawn/thinned cards to the bottom of the deck">Shuffle to Bottom</button>
          <button className={styles.drawHandBtn} onClick={() => handleDrawToHand(6)} disabled={remainingDeck.length === 0} title="Draw 6 cards to hand">Draw 6</button>
          <button className={styles.drawHandBtn} onClick={() => handleDrawToHand(8)} disabled={remainingDeck.length === 0} title="Draw 8 cards to hand">Draw 8</button>
          <button className={styles.undoBtn} onClick={handleUndo} disabled={history.length === 0} title="Undo last action">Undo</button>
          <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}/practice`)}>Back</button>
        </div>
      </div>

      {/* Row 1: Hand + Prizes + Next */}
      <div className={styles.dealStrip}>
        <div className={styles.stripGroup}>
          <div className={styles.stripLabel}>Hand</div>
          <div className={styles.stripCards}>
            {handCards.map((card, i) => (
              <DragCard key={i} onDragStart={() => { dragSourceRef.current = { zone: 'hand', index: i } }}>
                <div className={styles.stripCard}>{renderCard(card)}</div>
              </DragCard>
            ))}
            {handCards.length === 0 && <span className={styles.zoneEmpty}>Empty</span>}
          </div>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripGroup}>
          <div className={styles.stripLabel}>Prizes</div>
          <div className={styles.stripCards}>
            {hand.prizes.map((card, i) => (
              <div key={i} className={`${styles.stripCard} ${styles.prizeCard}`}>{renderCard(card)}</div>
            ))}
          </div>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripGroup}>
          <div className={styles.stripLabel}>Next</div>
          <div className={styles.stripCards}>
            {nextCard ? (
              <DragCard onDragStart={() => { dragSourceRef.current = { zone: 'next' } }}>
                <div className={styles.stripCard}>{renderCard(nextCard)}</div>
              </DragCard>
            ) : (
              <span className={styles.zoneEmpty}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Discard (full width) */}
      <div
        className={`${styles.discardRow}${dragOverZone === 'discard' ? ` ${styles.discardRowActive}` : ''}`}
        {...dropHandlers('discard')}
      >
        <div className={`${styles.zoneLabel} ${styles.zoneLabelDiscard}`}>Discard ({discardCards.length})</div>
        {discardCards.length === 0 ? (
          <p className={styles.zoneEmpty}>{dragOverZone === 'discard' ? 'Drop here' : 'Drag cards here'}</p>
        ) : (
          <div className={styles.discardScrollRow}>
            {discardCards.map((card, i) => (
              <DragCard key={i} onDragStart={() => { dragSourceRef.current = { zone: 'discard', index: i } }}>
                <div className={styles.discardCard}>{renderCard(card)}</div>
              </DragCard>
            ))}
          </div>
        )}
      </div>

      {/* Row 3: Draw/Thinned (left) + Deck horizontal scroll (right) */}
      <div className={styles.drawDeckRow}>
        <div className={styles.drawPanel}>
          <div className={styles.actionHeader}>
            <span className={styles.sectionLabel}>
              Drawn ({drawnCards.length}){thinnedCards.length > 0 ? ` / Thinned (${thinnedCards.length})` : ''}
            </span>
            <button className={styles.drawBtn} onClick={handleDraw} disabled={remainingDeck.length === 0}>Draw</button>
          </div>
          <div className={styles.drawnScrollRow}>
            {drawnCards.map((card, i) => (
              <DragCard key={`drawn-${i}`} onDragStart={() => { dragSourceRef.current = { zone: 'drawn', index: i } }}>
                <div className={`${styles.drawnCard} ${styles.drawnCardEntry}`}>{renderCard(card)}</div>
              </DragCard>
            ))}
            {thinnedCards.map((card, i) => (
              <DragCard key={`thinned-${i}`} onDragStart={() => { dragSourceRef.current = { zone: 'thinned', index: i } }}>
                <div className={`${styles.drawnCard} ${styles.thinnedCard}`}>{renderCard(card)}</div>
              </DragCard>
            ))}
            {drawnCards.length === 0 && thinnedCards.length === 0 && (
              <p className={styles.emptyHint}>Click Draw to pull from deck</p>
            )}
          </div>
        </div>
        <div className={styles.deckPanel}>
          <div className={styles.actionHeader}>
            <span className={styles.sectionLabel}>Deck ({remainingDeck.length})</span>
            <span className={styles.deckHint}>click to thin</span>
          </div>
          <div className={styles.deckScrollRow}>
            {sortedWithOriginalIndex.map(({ card, originalIndex }) => (
              <div key={originalIndex} className={styles.deckCard} onClick={() => handleThin(originalIndex)} title={`Thin ${card.name}`}>
                {renderCard(card)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Board */}
      <div className={styles.boardDiscardRow}>
        <div className={`${styles.zoneLabel} ${styles.zoneLabelBoard}`}>Board ({boardCount})</div>
        <div className={styles.boardLayout}>
          <div className={styles.activeArea}>
            {renderSlot(boardActive, 'active', 'Active', { zone: 'active' }, styles.activeSlot)}
          </div>
          <div className={styles.benchArea}>
            {boardBench.map((slot, i) => renderSlot(
              slot,
              `bench-${i}` as Destination,
              'Bench',
              { zone: 'bench', slotIndex: i },
              styles.benchSlot,
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}