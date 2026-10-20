import { useState, type FormEvent } from 'react'
import styles from './LoginPage.module.css'

interface Props {
  allowSignup: boolean
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, password: string) => Promise<void>
}

export default function LoginPage({ allowSignup, onLogin, onSignup }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await (isSignup ? onSignup : onLogin)(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function toggleMode() {
    setMode(isSignup ? 'login' : 'signup')
    setError(null)
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.title}>Poketools</h1>
        <p className={styles.subtitle}>
          {isSignup ? 'Create an account to build and save decks.' : 'Sign in to your decks.'}
        </p>
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
        <input
          className={styles.input}
          type="password"
          placeholder={isSignup ? 'Password (8+ characters)' : 'Password'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit" disabled={busy || email === '' || password === ''}>
          {isSignup ? (busy ? 'Creating account…' : 'Create account') : busy ? 'Signing in…' : 'Sign in'}
        </button>
        {allowSignup && (
          <p className={styles.switch}>
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <button type="button" className={styles.linkButton} onClick={toggleMode}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}
      </form>
    </div>
  )
}
