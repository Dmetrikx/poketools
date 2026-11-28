import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MatchupSetup from '@/components/game/MatchupSetup'
import { resolveDeck } from '@/components/game/resolveDeck'
import Table from '@/components/game/Table'
import setupStyles from '@/components/game/MatchupSetup.module.css'
import ui from '@/components/game/ui.module.css'
import { useDeck } from '@/hooks/useDeck'
import type { Deck } from '@/types/deck'

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
  if (deckA.loading || deckB.loading) return <p className={ui.muted}>Loading decks…</p>
  if (!deckA.deck || !deckB.deck) return <p className={ui.muted}>Couldn't load both decks.</p>
  return <Ready a={deckA.deck} b={deckB.deck} />
}

function Ready({ a, b }: { a: Deck; b: Deck }) {
  const navigate = useNavigate()
  const ra = useMemo(() => resolveDeck(a.entries ?? []), [a])
  const rb = useMemo(() => resolveDeck(b.entries ?? []), [b])
  if (ra.unsupported.length || rb.unsupported.length) {
    return (
      <div className={setupStyles.setup}>
        <p>These decks have cards outside the LAIC 2026–27 pool.</p>
        <button className={ui.secondary} onClick={() => navigate('/play')}>Choose other decks</button>
      </div>
    )
  }
  return <Table a={a} b={b} ra={ra} rb={rb} />
}
