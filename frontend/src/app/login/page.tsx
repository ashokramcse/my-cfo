'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Wallet, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [error, setError]           = useState('')

  // Redirect if already logged in (check localStorage directly — no hydration race)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (token) router.replace('/dashboard')
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(identifier.trim(), password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a2e 0%, #0a0f1e 60%, #050810 100%)' }}>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div
        className="w-full max-w-md"
        style={{ animation: 'fadeSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}>
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My CFO</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Personal Financial Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}>

          <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Sign in to your financial workspace
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Email or Username
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com or username"
                required
                className="auth-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="auth-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none pr-11 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', animation: 'fadeSlideIn 0.2s ease both' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
              style={{
                background: isLoading
                  ? 'rgba(249,115,22,0.5)'
                  : 'linear-gradient(135deg, #F97316, #ea580c)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#F97316' }}>
                Create account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Your data stays on your server. Always.
        </p>
      </div>
    </div>
  )
}
