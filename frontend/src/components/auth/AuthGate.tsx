'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Wallet } from 'lucide-react'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function check() {
      // ── Step 1: read token directly from localStorage (synchronous, always works) ──
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null

      if (!token) {
        router.replace('/login')
        return
      }

      // ── Step 2: sync token into the store if not already there ──
      const store = useAuthStore.getState()
      if (!store.accessToken) {
        store.setTokens(token, localStorage.getItem('refresh_token') ?? '')
      }

      // ── Step 3: validate the token by fetching user profile ──
      if (!useAuthStore.getState().user) {
        await useAuthStore.getState().loadUser()
      }

      // ── Step 4: check result ──
      const { user, accessToken } = useAuthStore.getState()
      if (!user || !accessToken) {
        router.replace('/login')
        return
      }

      setReady(true)
    }

    check()
  }, [router])

  // Eject mid-session if token is cleared by a 401
  const accessToken = useAuthStore((s) => s.accessToken)
  useEffect(() => {
    if (ready && !accessToken) router.replace('/login')
  }, [ready, accessToken, router])

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a2e 0%, #0a0f1e 60%, #050810 100%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}
          >
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
