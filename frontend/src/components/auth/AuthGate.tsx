'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Wallet } from 'lucide-react'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, accessToken, _hydrated, loadUser } = useAuthStore()
  const [ready, setReady] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    // Don't run until persist has rehydrated from localStorage
    if (!_hydrated) return
    // Only run once
    if (checked.current) return
    checked.current = true

    async function check() {
      const { accessToken: tok } = useAuthStore.getState()

      if (!tok) {
        router.replace('/login')
        return
      }

      // We have a token — ensure user profile is loaded
      const { user: u } = useAuthStore.getState()
      if (!u) {
        await loadUser()
      }

      // Final state check after loadUser
      const { user: u2, accessToken: tok2 } = useAuthStore.getState()
      if (!u2 || !tok2) {
        router.replace('/login')
        return
      }

      setReady(true)
    }

    check()
  }, [_hydrated, loadUser, router])

  // Watch for mid-session auth loss (e.g. 401 clears tokens)
  useEffect(() => {
    if (ready && !accessToken) {
      router.replace('/login')
    }
  }, [accessToken, ready, router])

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
