import { useCallback, useEffect, useState } from 'react'
import { authApi } from '@/api/auth'
import { UNAUTHORIZED_EVENT } from '@/api/client'
import type { User } from '@/types/auth'

// Loads the session once on mount, and drops back to logged-out whenever any
// API call comes back 401 (e.g. the session expired mid-use).
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [allowSignup, setAllowSignup] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(s => {
        setUser(s.user)
        setAllowSignup(s.allowSignup)
      })
      .catch(() => setUser(null))
      .finally(() => setChecking(false))

    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login({ email, password })
    setUser(user)
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.signup({ email, password })
    setUser(user)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined)
    setUser(null)
  }, [])

  return { user, allowSignup, checking, login, signup, logout }
}
