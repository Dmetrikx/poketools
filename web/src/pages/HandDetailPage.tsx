import { useState, useCallback, useEffect } from 'react'
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

type Destination = 'board' | 'discard'

type GameState = {
  handCards: CardEntry[]
  nextCard: CardEntry | null
  remainingDeck: CardEntry[]
  drawnCards: CardEntry[]
  thinnedCards: CardEntry[]
  boardCards: CardEntry[]
  discardCards: CardEntry[]
}

function HoverCard({
  onBoard,
  onDiscard,
  children,
}: {
  onBoard: () => void
  onDiscard: () => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={styles.hoverCardWrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <div className={styles.cardActions}>
          <button
            className={styles.boardBtn}
            onClick={(e) => { e.stopPropagation(); onBoard() }}
          >
            Board
          </button>
          <button
            className={styles.discardBtn}
            onClick={(e) => { e.stopPropagation(); onDiscard() }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}

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
      boardCards: [],
      discardCards: [],
    },
    history: [],
  }))

  const [imageMap] = useCardImages(state?.entries ?? [])

  const apply = useCallback((updater: (prev: GameState) => GameState) => {
    setStates(prev => ({
      history: [...prev.history, prev.current],
      current: updater(prev.current),
    }))
  }, [])

  const handleUndo = useCallback(() => {
    setStates(prev => {
      if (prev.history.length === 0) return prev
      return {
        history: prev.history.slice(0, -1),
        current: prev.history[prev.history.length - 1],
      }
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
      const rest = [...prev.remainingDeck.slice(0, index), ...prev.remainingDeck.slice(index + 1)]
      return { ...prev, remainingDeck: shuffle(rest), thinnedCards: [...prev.thinnedCards, card] }
    })
  }, [apply])

  const moveHandCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.handCards[idx]
      if (!card) return prev
      return {
        ...prev,
        handCards: [...prev.handCards.slice(0, idx), ...prev.handCards.slice(idx + 1)],
        boardCards: dest === 'board' ? [...prev.boardCards, card] : prev.boardCards,
        discardCards: dest === 'discard' ? [...prev.discardCards, card] : prev.discardCards,
      }
    })
  }, [apply])

  const moveDrawnCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.drawnCards[idx]
      if (!card) return prev
      return {
        ...prev,
        drawnCards: [...prev.drawnCards.slice(0, idx), ...prev.drawnCards.slice(idx + 1)],
        boardCards: dest === 'board' ? [...prev.boardCards, card] : prev.boardCards,
        discardCards: dest === 'discard' ? [...prev.discardCards, card] : prev.discardCards,
      }
    })
  }, [apply])

  const moveThinnedCard = useCallback((idx: number, dest: Destination) => {
    apply(prev => {
      const card = prev.thinnedCards[idx]
      if (!card) return prev
      return {
        ...prev,
        thinnedCards: [...prev.thinnedCards.slice(0, idx), ...prev.thinnedCards.slice(idx + 1)],
        boardCards: dest === 'board' ? [...prev.boardCards, card] : prev.boardCards,
        discardCards: dest === 'discard' ? [...prev.discardCards, card] : prev.discardCards,
      }
    })
  }, [apply])

  const moveNextCard = useCallback((dest: Destination) => {
    apply(prev => {
      if (!prev.nextCard) return prev
      return {
        ...prev,
        nextCard: null,
        boardCards: dest === 'board' ? [...prev.boardCards, prev.nextCard] : prev.boardCards,
        discardCards: dest === 'discard' ? [...prev.discardCards, prev.nextCard] : prev.discardCards,
      }
    })
  }, [apply])

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

  const { handCards, nextCard, remainingDeck, drawnCards, thinnedCards, boardCards, discardCards } = game

  // Map sorted indices back to actual remainingDeck indices
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
          {card.name}
          <br />
          <small>{card.setCode}</small>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
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
          <span className={styles.deckCount}>{remainingDeck.length} cards remaining</span>
          <button
            className={styles.undoBtn}
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo last action (⌘Z)"
          >
            Undo
          </button>
          <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}/practice`)}>
            Back
          </button>
        </div>
      </div>

      {/* Board & Discard zones */}
      <div className={styles.boardDiscardRow}>
        <div className={`${styles.zonePanel} ${styles.zonePanelBoard}`}>
          <div className={`${styles.zoneLabel} ${styles.zoneLabelBoard}`}>
            Board ({boardCards.length})
          </div>
          {boardCards.length === 0 ? (
            <p className={styles.zoneEmpty}>No cards on board yet</p>
          ) : (
            <div className={styles.zoneCards}>
              {boardCards.map((card, i) => (
                <div key={i} className={styles.zoneCard}>{renderCard(card)}</div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.zonePanel} ${styles.zonePanelDiscard}`}>
          <div className={`${styles.zoneLabel} ${styles.zoneLabelDiscard}`}>
            Discard ({discardCards.length})
          </div>
          {discardCards.length === 0 ? (
            <p className={styles.zoneEmpty}>No cards discarded yet</p>
          ) : (
            <div className={styles.zoneCards}>
              {discardCards.map((card, i) => (
                <div key={i} className={styles.zoneCard}>{renderCard(card)}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compact top strip: opening hand, prizes, next card */}
      <div className={styles.dealStrip}>
        <div className={styles.stripGroup}>
          <div className={styles.stripLabel}>Hand</div>
          <div className={styles.stripCards}>
            {handCards.map((card, i) => (
              <HoverCard
                key={i}
                onBoard={() => moveHandCard(i, 'board')}
                onDiscard={() => moveHandCard(i, 'discard')}
              >
                <div className={styles.stripCard}>{renderCard(card)}</div>
              </HoverCard>
            ))}
            {handCards.length === 0 && (
              <span className={styles.zoneEmpty}>Empty</span>
            )}
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
              <HoverCard
                onBoard={() => moveNextCard('board')}
                onDiscard={() => moveNextCard('discard')}
              >
                <div className={styles.stripCard}>{renderCard(nextCard)}</div>
              </HoverCard>
            ) : (
              <span className={styles.zoneEmpty}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: draw + thin */}
      <div className={styles.mainLayout}>
        <div className={styles.leftColumn}>
          <div className={styles.actionPanel}>
            <div className={styles.actionHeader}>
              <span className={styles.sectionLabel}>Drawn Cards ({drawnCards.length})</span>
              <button
                className={styles.drawBtn}
                onClick={handleDraw}
                disabled={remainingDeck.length === 0}
              >
                Draw
              </button>
            </div>
            <div className={styles.cardRow}>
              {drawnCards.map((card, i) => (
                <HoverCard
                  key={i}
                  onBoard={() => moveDrawnCard(i, 'board')}
                  onDiscard={() => moveDrawnCard(i, 'discard')}
                >
                  <div className={`${styles.cardThumbnail} ${styles.drawnCardEntry}`}>{renderCard(card)}</div>
                </HoverCard>
              ))}
              {drawnCards.length === 0 && (
                <p className={styles.emptyHint}>Click "Draw" to pull from the top of the deck</p>
              )}
            </div>
          </div>

          {thinnedCards.length > 0 && (
            <div className={styles.actionPanel}>
              <div className={styles.sectionLabel}>Thinned Cards ({thinnedCards.length})</div>
              <div className={styles.cardRow}>
                {thinnedCards.map((card, i) => (
                  <HoverCard
                    key={i}
                    onBoard={() => moveThinnedCard(i, 'board')}
                    onDiscard={() => moveThinnedCard(i, 'discard')}
                  >
                    <div className={`${styles.cardThumbnail} ${styles.thinnedCard}`}>{renderCard(card)}</div>
                  </HoverCard>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.actionPanel}>
            <div className={styles.actionHeader}>
              <span className={styles.sectionLabel}>
                Remaining Deck ({remainingDeck.length})
              </span>
            </div>
            <p className={styles.emptyHint}>Click a card to thin it (deck reshuffles after)</p>
            <div className={styles.thinGrid}>
              {sortedWithOriginalIndex.map(({ card, originalIndex }) => (
                <div
                  key={originalIndex}
                  className={styles.thinCard}
                  onClick={() => handleThin(originalIndex)}
                  title={`Thin ${card.name}`}
                >
                  {renderCard(card)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}