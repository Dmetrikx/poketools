import { useState } from 'react'
import { useCardSearch } from '@/hooks/useCardSearch'
import type { CardBrief } from '@/types/card'
import styles from './CardSearch.module.css'

interface Props {
  onSelect: (card: CardBrief) => void
}

export default function CardSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const { results, loading } = useCardSearch(query)

  return (
    <div className={styles.container}>
      <input
        className={styles.input}
        type="text"
        placeholder="Search cards…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
      />
      {loading && <p className={styles.status}>Searching…</p>}
      {!loading && query.trim() && results.length === 0 && (
        <p className={styles.status}>No results for "{query}"</p>
      )}
      <ul className={styles.results}>
        {results.map(card => (
          <li key={card.id} className={styles.result} onClick={() => onSelect(card)}>
            <div className={styles.cardName}>{card.name}</div>
            <div className={styles.cardSet}>{card.setId ?? card.setName} {card.number}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
