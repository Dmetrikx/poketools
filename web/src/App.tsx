import { Routes, Route } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import HomePage from '@/pages/HomePage'
import DeckEditorPage from '@/pages/DeckEditorPage'
import ImportPage from '@/pages/ImportPage'
import LoginPage from '@/pages/LoginPage'
import { useAuth } from '@/hooks/useAuth'

export default function App() {
  const { user, allowSignup, checking, login, signup, logout } = useAuth()

  if (checking) return null
  if (!user) {
    // Rendered in place of the routes, so after logging in the user lands on
    // whatever URL they originally opened.
    return <LoginPage allowSignup={allowSignup} onLogin={login} onSignup={signup} />
  }

  return (
    <AppShell user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/decks/:id" element={<DeckEditorPage />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </AppShell>
  )
}
