import type { CardEntry, Section } from '@/types/deck'
import CardRow from './CardRow'
import styles from './SectionGroup.module.css'

const LABELS: Record<Section, string> = {
  pokemon: 'Pokémon',
  trainer: 'Trainer',
  energy: 'Energy',
}

interface Props {
  section: Section
  entries: CardEntry[]
  onIncrement: (entry: CardEntry) => void
  onDecrement: (entry: CardEntry) => void
  onRemove: (entry: CardEntry) => void
}

export default function SectionGroup({ section, entries, onIncrement, onDecrement, onRemove }: Props) {
  const total = entries.reduce((sum, e) => sum + e.count, 0)
  if (entries.length === 0) return null

  return (
    <div className={styles.group}>
      <div className={styles.header}>
        <span className={styles.label}>{LABELS[section]}</span>
        <span className={styles.count}>{total}</span>
      </div>
      {entries.map(entry => (
        <CardRow
          key={entry.id}
          entry={entry}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
