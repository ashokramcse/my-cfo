import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  username: string
  full_name?: string
  phone?: string
  country: string
  currency: string
  timezone: string
  avatar_url?: string
  profile_bio?: string
  is_verified: boolean
  created_at: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  _hydrated: boolean          // true once zustand persist has rehydrated from localStorage

  login: (identifier: string, password: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
  loadUser: () => Promise<void>
  setTokens: (access: string, refresh: string) => void
  clearAuth: () => void
  setHydrated: () => void
}

export interface RegisterPayload {
  email: string
  username: string
  password: string
  full_name?: string
  phone?: string
  country?: string
  currency?: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      _hydrated: false,

      setHydrated: () => set({ _hydrated: true }),

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh })
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access)
          localStorage.setItem('refresh_token', refresh)
        }
      },

      clearAuth: () => {
        set({ user: null, accessToken: null, refreshToken: null })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      },

      login: async (identifier, password) => {
        set({ isLoading: true })
        try {
          const resp = await api.post('/auth/login', { identifier, password })
          const { access_token, refresh_token } = resp.data
          get().setTokens(access_token, refresh_token)
          await get().loadUser()
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (data) => {
        set({ isLoading: true })
        try {
          await api.post('/auth/register', data)
          await get().login(data.username, data.password)
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) {
            await api.post('/auth/logout', { refresh_token: refreshToken })
          }
        } catch {
          // best-effort
        } finally {
          get().clearAuth()
        }
      },

      refreshSession: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const resp = await api.post('/auth/refresh', { refresh_token: refreshToken })
          const { access_token, refresh_token } = resp.data
          get().setTokens(access_token, refresh_token)
          return true
        } catch {
          get().clearAuth()
          return false
        }
      },

      loadUser: async () => {
        try {
          const resp = await api.get('/auth/me')
          set({ user: resp.data })
        } catch {
          get().clearAuth()
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          localStorage.setItem('access_token', state.accessToken)
        }
        if (state?.refreshToken) {
          localStorage.setItem('refresh_token', state.refreshToken)
        }
        // Mark hydration complete so AuthGate knows it can safely read tokens
        useAuthStore.getState().setHydrated()
      },
    }
  )
)
