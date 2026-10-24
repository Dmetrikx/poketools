import { useState, useEffect, useCallback } from 'react'
import { imageKey } from '@/hooks/useCardImages'
import { useBasicPokemon, EVOLVED_STAGES } from '@/hooks/useBasicPokemon'
import { dealHand, deckSignature, type Hand } from '@/practice/deal'
import type { CardEntry, Deck } from '@/types/deck'
import PlayingCard from './PlayingCard'
import DeckFan from './DeckFan'
import DeckSheet from './DeckSheet'
import styles from './PracticeHandModal.module.css'

interface Props {
  deck: Deck
  imageMap: Map<string, string>
  onClose: () => void
}

/** Everything about the current practice hand that survives closing the modal. */
interface Session {
  signature: string
  hand: Hand
  revealedPrizes: number[]
  nextRevealed: boolean
  marked: number[]
}

function loadSession(key: string, signature: string): Session | null {
  try {
    const raw = localStorage.getItem(key)
    const session = raw ? (JSON.parse(raw) as Session) : null
    // A hand dealt from an older version of the deck is stale.
    return session?.signature === signature ? session : null
  } catch {
    return null
  }
}

function saveSession(key: string, session: Session) {
  try {
    localStorage.setItem(key, JSON.stringify(session))
  } catch {
    // Storage unavailable: the hand lasts until the modal closes
  }
}

export default function PracticeHandModal({ deck, imageMap, onClose }: Props) {
  const entries = deck.entries
  const sessionKey = `practice-hand-${deck.id}`
  const signature = deckSignature(entries)

  const { stageMap, basicOverrides, toggleBasic, ready } = useBasicPokemon(deck.id, entries)
  const [session, setSession] = useState<Session | null>(() => loadSession(sessionKey, signature))
  const [deckOpen, setDeckOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const update = useCallback((next: Session) => {
    setSession(next)
    saveSession(sessionKey, next)
  }, [sessionKey])

  const deal = useCallback(() => {
    const isBasic = (e: CardEntry) => e.section === 'pokemon' && basicOverrides.has(imageKey(e))
    update({ signature, hand: dealHand(entries, isBasic), revealedPrizes: [], nextRevealed: false, marked: [] })
    setDeckOpen(false)
  }, [entries, basicOverrides, signature, update])

  // Deal once basics are known, unless a hand for this exact deck was restored.
  useEffect(() => {
    if (ready && !session) deal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const totalCards = entries.reduce((s, e) => s + e.count, 0)
  const uniquePokemon = Array.from(
    new Map(entries.filter(e => e.section === 'pokemon').map(e => [imageKey(e), e])).values()
  )

  const imageFor = (entry: CardEntry) => imageMap.get(imageKey(entry))

  const revealPrize = (uid: number) => {
    if (!session || session.revealedPrizes.includes(uid)) return
    update({ ...session, revealedPrizes: [...session.revealedPrizes, uid] })
  }

  const toggleMark = (uid: number) => {
    if (!session) return
    const marked = session.marked.includes(uid)
      ? session.marked.filter(m => m !== uid)
      : [...session.marked, uid]
    update({ ...session, marked })
  }

  const hand = session?.hand
  const revealed = new Set(session?.revealedPrizes)
  const allPrizesRevealed = !!hand && hand.prizes.every(p => revealed.has(p.uid))

  return (
    // mousedown, not click: a drag that ends outside the modal must not close it
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-label="Test draw">
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Test draw</h2>
            {hand && hand.mulligans > 0 && (
              <span className={styles.mulliganBadge}>
                {hand.mulligans} {hand.mulligans === 1 ? 'mulligan' : 'mulligans'}
              </span>
            )}
            {totalCards !== 60 && (
              <span className={styles.warning}>Deck has {totalCards} cards (need 60)</span>
            )}
          </div>
          <div className={styles.headerActions}>
            {uniquePokemon.length > 0 && (
              <button
                className={`${styles.secondaryBtn} ${showSettings ? styles.secondaryActive : ''}`}
                onClick={() => setShowSettings(s => !s)}
              >Basic Pokémon</button>
            )}
            <button className={styles.primaryBtn} onClick={deal} disabled={!ready}>
              New hand
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        {showSettings && (
          <div className={styles.settings}>
            <div className={styles.settingsHint}>Hands are redealt until they contain one of these. Changes apply to the next hand.</div>
            <div className={styles.pokemonList}>
              {uniquePokemon.map(entry => {
                const k = imageKey(entry)
                const stage = stageMap[k]
                const isBasic = basicOverrides.has(k)
                return (
                  <label key={k} className={`${styles.pokemonItem} ${isBasic ? styles.pokemonItemChecked : ''}`}>
                    <input type="checkbox" checked={isBasic} onChange={() => toggleBasic(k)} />
                    <span>{entry.name}</span>
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

        {!hand ? (
          <p className={styles.status}>Shuffling…</p>
        ) : (
          <>
            <section>
              <div className={styles.label}>Hand</div>
              <div className={styles.handRow}>
                {hand.hand.map(card => (
                  <PlayingCard
                    key={card.uid}
                    entry={card.entry}
                    image={imageFor(card.entry)}
                    faceUp
                    className={styles.handCard}
                  />
                ))}
              </div>
            </section>

            <div className={styles.board}>
              <section>
                <div className={styles.labelRow}>
                  <span className={styles.label}>Prizes</span>
                  <button
                    className={styles.linkBtn}
                    onClick={() => update({ ...session!, revealedPrizes: hand.prizes.map(p => p.uid) })}
                    disabled={allPrizesRevealed}
                  >Reveal all</button>
                </div>
                <div className={styles.prizeGrid}>
                  {hand.prizes.map(card => (
                    <PlayingCard
                      key={card.uid}
                      entry={card.entry}
                      image={imageFor(card.entry)}
                      faceUp={revealed.has(card.uid)}
                      onClick={revealed.has(card.uid) ? undefined : () => revealPrize(card.uid)}
                      title={revealed.has(card.uid) ? undefined : 'Click to reveal'}
                      className={styles.boardCard}
                    />
                  ))}
                </div>
              </section>

              {hand.nextCard && (
                <section>
                  <div className={styles.label}>Next card</div>
                  <PlayingCard
                    entry={hand.nextCard.entry}
                    image={imageFor(hand.nextCard.entry)}
                    faceUp={session!.nextRevealed}
                    onClick={session!.nextRevealed ? undefined : () => update({ ...session!, nextRevealed: true })}
                    title={session!.nextRevealed ? undefined : 'Click to reveal'}
                    className={styles.boardCard}
                  />
                </section>
              )}

              <section>
                <div className={styles.label}>Deck</div>
                <div
                  className={`${styles.pile} ${deckOpen ? styles.pileLifted : ''}`}
                  onClick={() => setDeckOpen(o => !o)}
                  title={deckOpen ? 'Put the deck down' : 'Pick up the deck'}
                >
                  <span className={styles.pileShadow} />
                  <span className={styles.pileShadow} />
                  <PlayingCard entry={hand.deck[0]?.entry ?? hand.hand[0].entry} image={undefined} faceUp={false} className={styles.boardCard} />
                  <span className={styles.pileCount}>{hand.deck.length}</span>
                </div>
                <button className={styles.linkBtn} onClick={() => setDeckOpen(o => !o)} disabled={hand.deck.length === 0}>
                  {deckOpen ? 'Put down' : 'Pick up deck'}
                </button>
              </section>
            </div>

            {deckOpen && (
              <DeckSheet onClose={() => setDeckOpen(false)}>
                <DeckFan
                  cards={hand.deck}
                  imageMap={imageMap}
                  marked={new Set(session!.marked)}
                  onToggleMark={toggleMark}
                  onClearMarks={() => update({ ...session!, marked: [] })}
                />
              </DeckSheet>
            )}
          </>
        )}
      </div>
    </div>
  )
}
