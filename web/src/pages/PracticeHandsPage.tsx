import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDeck } from '@/hooks/useDeck'
import { useCardImages, imageKey, cardImageUrl } from '@/hooks/useCardImages'
import { cardsApi } from '@/api/cards'
import type { CardEntry } from '@/types/deck'
import styles from './PracticeHandsPage.module.css'

export interface Hand {
  hand: CardEntry[]
  prizes: CardEntry[]
  nextCard: CardEntry
  remainingDeck: CardEntry[]
  mulligans: number
}

// Stages from TCGdex that are definitively not basic Pokémon.
// Unknown/empty stage is treated as potentially basic (graceful degradation).
const EVOLVED_STAGES = new Set(['Stage1', 'Stage2', 'MEGA', 'BREAK'])

function loadSessionJSON<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function PracticeHandsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deck, loading, error } = useDeck(id!)

  const handsKey = `practice-hands-${id}`
  const overridesKey = `practice-overrides-${id}`

  const [hands, setHands] = useState<Hand[]>(() => loadSessionJSON<Hand[]>(handsKey) ?? [])
  const [generatingHands, setGeneratingHands] = useState(false)
  const [stageMap, setStageMap] = useState<Record<string, string>>({})
  const [basicOverrides, setBasicOverrides] = useState<Set<string>>(() => {
    const saved = loadSessionJSON<string[]>(overridesKey)
    return saved ? new Set(saved) : new Set()
  })
  const [overridesInitialized, setOverridesInitialized] = useState(false)
  const hadSavedOverrides = useRef(sessionStorage.getItem(overridesKey) !== null)

  const entries = deck?.entries ?? []
  const [imageMap] = useCardImages(entries)

  // Fetch stage data then initialise basicOverrides from it.
  useEffect(() => {
    if (!deck) return

    const pokemonEntries = entries.filter(e => e.section === 'pokemon')
    if (pokemonEntries.length === 0) {
      setOverridesInitialized(true)
      return
    }

    const fetchStages = async () => {
      const stages: Record<string, string> = {}
      // Deduplicate by imageKey — same key used everywhere for consistency
      const seen = new Set<string>()
      const unique = pokemonEntries.filter(e => {
        const k = imageKey(e)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      await Promise.all(
        unique.map(async entry => {
          const k = imageKey(entry)
          try {
            const card = await cardsApi.get(entry.cardId || k)
            stages[k] = card.stage ?? ''
          } catch {
            // Silently skip — unknown stage → treated as basic
          }
        })
      )

      setStageMap(stages)

      // Only seed overrides from stage data if no saved overrides exist
      if (!hadSavedOverrides.current) {
        const initialBasics = new Set(
          pokemonEntries
            .filter(e => !EVOLVED_STAGES.has(stages[imageKey(e)]))
            .map(e => imageKey(e))
        )
        setBasicOverrides(initialBasics)
        sessionStorage.setItem(overridesKey, JSON.stringify([...initialBasics]))
      }
      setOverridesInitialized(true)
    }

    fetchStages()
  }, [deck?.id, entries.length])

  const toggleBasic = useCallback((cardId: string) => {
    setBasicOverrides(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      sessionStorage.setItem(overridesKey, JSON.stringify([...next]))
      return next
    })
  }, [overridesKey])

  const generateHands = useCallback(() => {
    if (!deck) return

    setGeneratingHands(true)

    const pool = entries.flatMap(e => Array(e.count).fill(e))

    const isBasicPokemon = (entry: CardEntry): boolean =>
      entry.section === 'pokemon' && basicOverrides.has(imageKey(entry))

    const generatedHands: Hand[] = []
    let handIndex = 0

    const generateNextHand = () => {
      if (handIndex >= 10) {
        setHands(generatedHands)
        sessionStorage.setItem(handsKey, JSON.stringify(generatedHands))
        setGeneratingHands(false)
        return
      }

      let mulligans = 0
      let hand: CardEntry[] = []
      let prizes: CardEntry[] = []
      let shuffled: CardEntry[] = []
      let valid = false

      while (!valid && mulligans < 500) {
        shuffled = [...pool]
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
        }

        hand = shuffled.slice(0, 7)
        prizes = shuffled.slice(7, 13)

        if (hand.some(c => isBasicPokemon(c))) {
          valid = true
        } else {
          mulligans++
        }
      }

      generatedHands.push({ hand, prizes, nextCard: shuffled[13], remainingDeck: shuffled.slice(14), mulligans })
      handIndex++
      setTimeout(generateNextHand, 0)
    }

    generateNextHand()
  }, [deck, entries, basicOverrides, handsKey])

  // Generate initial hands once overrides are ready (skip if hands restored from session)
  useEffect(() => {
    if (deck && overridesInitialized && hands.length === 0) {
      generateHands()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridesInitialized])

  if (loading) return <p className={styles.status}>Loading deck…</p>
  if (error) return <p className={styles.error}>{error}</p>
  if (!deck) return null

  const totalCards = entries.reduce((s, e) => s + e.count, 0)
  const canPractice = totalCards === 60

  // Unique Pokémon entries for the override UI (deduped by imageKey)
  const uniquePokemon = Array.from(
    new Map(
      entries.filter(e => e.section === 'pokemon').map(e => [imageKey(e), e])
    ).values()
  )

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

      {uniquePokemon.length > 0 && (
        <div className={styles.basicConfig}>
          <div className={styles.basicConfigTitle}>Basic Pokémon</div>
          <div className={styles.pokemonList}>
            {uniquePokemon.map(entry => {
              const k = imageKey(entry)
              const stage = stageMap[k]
              const isBasic = basicOverrides.has(k)
              return (
                <label key={k} className={`${styles.pokemonItem} ${isBasic ? styles.pokemonItemChecked : ''}`}>
                  <input
                    type="checkbox"
                    checked={isBasic}
                    onChange={() => toggleBasic(k)}
                  />
                  <span className={styles.pokemonName}>{entry.name}</span>
                  {stage && (
                    <span className={`${styles.stageBadge} ${EVOLVED_STAGES.has(stage) ? styles.stageEvolved : styles.stageBasic}`}>
                      {stage}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className={styles.handsGrid}>
        {hands.map((h, idx) => (
          <div
            key={idx}
            className={styles.handPanel}
            onClick={() => navigate(`/decks/${id}/practice/${idx}`, { state: { hand: h, entries } })}
          >
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

            <div className={styles.bottomSection}>
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

              <div className={styles.nextCardSection}>
                <div className={styles.nextCardLabel}>Next Card</div>
                <div className={styles.nextCardDisplay}>
                  {(() => {
                    const key = imageKey(h.nextCard)
                    const img = imageMap.get(key)
                    return (
                      <>
                        {img ? (
                          <img src={cardImageUrl(img, 'low')} alt={h.nextCard.name} title={h.nextCard.name} />
                        ) : (
                          <div className={styles.cardPlaceholder}>
                            <div className={styles.placeholderText}>
                              {h.nextCard.name}
                              <br />
                              <small>{h.nextCard.setCode}</small>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
