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

export default function HandDetailPage() {
  const { id, handIndex } = useParams<{ id: string; handIndex: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const [remainingDeck, setRemainingDeck] = useState<CardEntry[]>(state?.hand.remainingDeck ?? [])
  const [drawnCards, setDrawnCards] = useState<CardEntry[]>([])
  const [thinnedCards, setThinnedCards] = useState<CardEntry[]>([])

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
        <h1 className={styles.title}>Hand {handNum}</h1>
        <div className={styles.headerActions}>
          <span className={styles.deckCount}>{remainingDeck.length} cards remaining</span>
          <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}/practice`)}>
            ← Back to Practice Hands
          </button>
        </div>
      </div>

      {hand.mulligans > 0 && (
        <span className={styles.mulliganBadge}>
          {hand.mulligans} {hand.mulligans === 1 ? 'mulligan' : 'mulligans'}
        </span>
      )}

      <div className={styles.mainLayout}>
        {/* Left column: hand, prizes, draw */}
        <div className={styles.leftColumn}>
          {/* Opening hand */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Opening Hand</div>
            <div className={styles.cardRow}>
              {hand.hand.map((card, i) => (
                <div key={i} className={styles.cardThumbnail}>{renderCard(card)}</div>
              ))}
            </div>
          </div>

          {/* Prizes + Next Card */}
          <div className={styles.prizesRow}>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Prize Cards</div>
              <div className={styles.cardRow}>
                {hand.prizes.map((card, i) => (
                  <div key={i} className={`${styles.cardThumbnail} ${styles.prizeCard}`}>{renderCard(card)}</div>
                ))}
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Next Card</div>
              <div className={styles.cardThumbnail}>{renderCard(hand.nextCard)}</div>
            </div>
          </div>

          {/* Draw area */}
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
                <div key={i} className={styles.cardThumbnail}>{renderCard(card)}</div>
              ))}
              {drawnCards.length === 0 && (
                <p className={styles.emptyHint}>Click "Draw" to pull from the top of the deck</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: remaining deck (thin) + thinned */}
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

          {thinnedCards.length > 0 && (
            <div className={styles.actionPanel}>
              <div className={styles.sectionLabel}>Thinned Cards ({thinnedCards.length})</div>
              <div className={styles.cardRow}>
                {thinnedCards.map((card, i) => (
                  <div key={i} className={`${styles.cardThumbnail} ${styles.thinnedCard}`}>{renderCard(card)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
