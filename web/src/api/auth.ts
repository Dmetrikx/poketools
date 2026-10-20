import { api } from './client'
import type { AuthState, User } from '@/types/auth'

interface Credentials {
  email: string
  password: string
}

export const authApi = {
  me: () => api.get<AuthState>('/auth/me'),
  signup: (c: Credentials) => api.post<{ user: User }>('/auth/signup', c),
  login: (c: Credentials) => api.post<{ user: User }>('/auth/login', c),
  logout: () => api.post<void>('/auth/logout'),
}
