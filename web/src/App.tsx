import { Routes, Route } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import HomePage from '@/pages/HomePage'
import DeckEditorPage from '@/pages/DeckEditorPage'
import ImportPage from '@/pages/ImportPage'
import PracticeHandsPage from '@/pages/PracticeHandsPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/decks/:id" element={<DeckEditorPage />} />
        <Route path="/decks/:id/practice" element={<PracticeHandsPage />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </AppShell>
  )
}
