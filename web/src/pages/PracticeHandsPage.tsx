import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDeck } from '@/hooks/useDeck'
import { useCardImages, imageKey, cardImageUrl } from '@/hooks/useCardImages'
import { cardsApi } from '@/api/cards'
import type { CardEntry } from '@/types/deck'
import styles from './PracticeHandsPage.module.css'

interface Hand {
  hand: CardEntry[]
  prizes: CardEntry[]
  mulligans: number
}

export default function PracticeHandsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deck, loading, error } = useDeck(id!)

  const [hands, setHands] = useState<Hand[]>([])
  const [generatingHands, setGeneratingHands] = useState(false)
  const [stageMap, setStageMap] = useState<Record<string, string>>({})
  const [stagesLoaded, setStagesLoaded] = useState(false)

  // Get all entries for image resolution
  const entries = deck?.entries ?? []
  const [imageMap] = useCardImages(entries)

  // Fetch stage data for all Pokémon entries on mount
  useEffect(() => {
    if (!deck) return

    const pokemonEntries = entries.filter(e => e.section === 'pokemon')
    if (pokemonEntries.length === 0) {
      setStagesLoaded(true)
      return
    }

    const fetchStages = async () => {
      const stages: Record<string, string> = {}
      const unique = Array.from(new Set(pokemonEntries.map(e => e.cardId)))

      await Promise.all(
        unique.map(async cardId => {
          try {
            const card = await cardsApi.get(cardId)
            stages[cardId] = card.stage ?? ''
          } catch {
            // Silently skip if card fetch fails
          }
        })
      )

      setStageMap(stages)
      setStagesLoaded(true)
    }

    fetchStages()
  }, [deck?.id, entries.length])

  const generateHands = () => {
    if (!deck) return

    setGeneratingHands(true)

    // Expand deck pool: each entry becomes count copies
    const pool = entries.flatMap(e => Array(e.count).fill(e))

    // Function to check if a card is a basic Pokémon
    const isBasicPokemon = (entry: CardEntry): boolean => {
      if (entry.section !== 'pokemon') return false
      const stage = stageMap[entry.cardId]
      return stage === 'Basic'
    }

    // Generate hands
    const generatedHands: Hand[] = []
    for (let i = 0; i < 10; i++) {
      let mulligans = 0
      let hand: CardEntry[] = []
      let prizes: CardEntry[] = []
      let valid = false

      // Keep shuffling until we get a valid hand (with at least 1 basic Pokémon)
      while (!valid) {
        // Shuffle pool using Fisher-Yates
        const shuffled = [...pool]
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
        }

        hand = shuffled.slice(0, 7)
        prizes = shuffled.slice(7, 13)

        // Check if hand has at least one basic Pokémon
        if (hand.some(c => isBasicPokemon(c))) {
          valid = true
        } else {
          mulligans++
        }
      }

      generatedHands.push({ hand, prizes, mulligans })
    }

    setHands(generatedHands)
    setGeneratingHands(false)
  }

  // Generate initial hands on mount when stages are loaded
  useEffect(() => {
    if (deck && stagesLoaded && hands.length === 0) {
      generateHands()
    }
  }, [deck, stagesLoaded, hands.length])

  if (loading) return <p className={styles.status}>Loading deck…</p>
  if (error) return <p className={styles.error}>{error}</p>
  if (!deck) return null

  const totalCards = entries.reduce((s, e) => s + e.count, 0)
  const canPractice = totalCards === 60

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Practice Hands: {deck.name}</h1>
          {!canPractice && (
            <p className={styles.warning}>Deck has {totalCards} cards (need 60 for meaningful practice)</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={generateHands}
            disabled={generatingHands}
          >
            {generatingHands ? 'Generating…' : 'Refresh 10 Hands'}
          </button>
          <button className={styles.backBtn} onClick={() => navigate(`/decks/${id}`)}>
            ← Back to Deck
          </button>
        </div>
      </div>

      <div className={styles.handsGrid}>
        {hands.map((h, idx) => (
          <div key={idx} className={styles.handPanel}>
            <div className={styles.handHeader}>
              <span className={styles.handNumber}>Hand {idx + 1}</span>
              {h.mulligans > 0 && (
                <span className={styles.mulliganBadge}>
                  {h.mulligans} {h.mulligans === 1 ? 'mulligan' : 'mulligans'}
                </span>
              )}
            </div>

            <div className={styles.cardRow}>
              {h.hand.map((card, cardIdx) => {
                const key = imageKey(card)
                const img = imageMap.get(key)
                return (
                  <div key={cardIdx} className={styles.cardThumbnail}>
                    {img ? (
                      <img src={cardImageUrl(img, 'low')} alt={card.name} title={card.name} />
                    ) : (
                      <div className={styles.cardPlaceholder}>
                        <div className={styles.placeholderText}>
                          {card.name}
                          <br />
                          <small>{card.setCode}</small>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={styles.prizeSection}>
              <div className={styles.prizeLabel}>Prize Cards</div>
              <div className={styles.cardRow}>
                {h.prizes.map((card, cardIdx) => {
                  const key = imageKey(card)
                  const img = imageMap.get(key)
                  return (
                    <div key={cardIdx} className={`${styles.cardThumbnail} ${styles.prizeCard}`}>
                      {img ? (
                        <img src={cardImageUrl(img, 'low')} alt={card.name} title={card.name} />
                      ) : (
                        <div className={styles.cardPlaceholder}>
                          <div className={styles.placeholderText}>
                            {card.name}
                            <br />
                            <small>{card.setCode}</small>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
