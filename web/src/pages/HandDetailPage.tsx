import { useState, useCallback } from 'react'
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

  const [handCards, setHandCards] = useState<CardEntry[]>(state?.hand.hand ?? [])
  const [nextCard, setNextCard] = useState<CardEntry | null>(state?.hand.nextCard ?? null)
  const [remainingDeck, setRemainingDeck] = useState<CardEntry[]>(state?.hand.remainingDeck ?? [])
  const [drawnCards, setDrawnCards] = useState<CardEntry[]>([])
  const [thinnedCards, setThinnedCards] = useState<CardEntry[]>([])
  const [boardCards, setBoardCards] = useState<CardEntry[]>([])
  const [discardCards, setDiscardCards] = useState<CardEntry[]>([])

  const [imageMap] = useCardImages(state?.entries ?? [])

  const handleDraw = useCallback(() => {
    if (remainingDeck.length === 0) return
    const [drawn, ...rest] = remainingDeck
    setDrawnCards(prev => [...prev, drawn])
    setRemainingDeck(rest)
  }, [remainingDeck])

  const handleThin = useCallback((index: number) => {
    const card = remainingDeck[index]
    const next = [...remainingDeck.slice(0, index), ...remainingDeck.slice(index + 1)]
    setRemainingDeck(shuffle(next))
    setThinnedCards(prev => [...prev, card])
  }, [remainingDeck])

  const moveHandCard = useCallback((idx: number, dest: Destination) => {
    const card = handCards[idx]
    if (!card) return
    setHandCards(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)])
    if (dest === 'board') setBoardCards(prev => [...prev, card])
    else setDiscardCards(prev => [...prev, card])
  }, [handCards])

  const moveDrawnCard = useCallback((idx: number, dest: Destination) => {
    const card = drawnCards[idx]
    if (!card) return
    setDrawnCards(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)])
    if (dest === 'board') setBoardCards(prev => [...prev, card])
    else setDiscardCards(prev => [...prev, card])
  }, [drawnCards])

  const moveThinnedCard = useCallback((idx: number, dest: Destination) => {
    const card = thinnedCards[idx]
    if (!card) return
    setThinnedCards(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)])
    if (dest === 'board') setBoardCards(prev => [...prev, card])
    else setDiscardCards(prev => [...prev, card])
  }, [thinnedCards])

  const moveNextCard = useCallback((dest: Destination) => {
    if (!nextCard) return
    const card = nextCard
    setNextCard(null)
    if (dest === 'board') setBoardCards(prev => [...prev, card])
    else setDiscardCards(prev => [...prev, card])
  }, [nextCard])

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