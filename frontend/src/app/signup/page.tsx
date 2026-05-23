'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Wallet, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD']
const COUNTRIES  = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'UAE' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters',     pass: password.length >= 8 },
    { label: 'Uppercase letter',  pass: /[A-Z]/.test(password) },
    { label: 'Number',            pass: /\d/.test(password) },
  ]
  if (!password) return null
  return (
    <div className="flex gap-2 mt-2">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-1 text-xs"
          style={{ color: c.pass ? '#34d399' : 'rgba(255,255,255,0.35)' }}>
          <Check className={`w-3 h-3 ${c.pass ? 'opacity-100' : 'opacity-30'}`} />
          {c.label}
        </div>
      ))}
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const { register, isLoading, user } = useAuthStore()

  const [step, setStep]         = useState(1)
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  const [form, setForm] = useState({
    email: '', username: '', password: '',
    full_name: '', phone: '', country: 'IN', currency: 'INR',
  })

  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function validateStep1() {
    if (!form.email || !form.username || !form.password) return 'All fields are required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email address'
    if (!/^[a-z0-9_]{3,30}$/.test(form.username)) return 'Username: 3–30 chars, lowercase letters/digits/underscores'
    if (form.password.length < 8) return 'Password must be at least 8 characters'
    return ''
  }

  function goNext() {
    const err = validateStep1()
    if (err) { setError(err); return }
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await register({
        email: form.email,
        username: form.username.toLowerCase(),
        password: form.password,
        full_name: form.full_name || undefined,
        phone: form.phone || undefined,
        country: form.country,
        currency: form.currency,
      })
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Registration failed. Please try again.')
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
  }
  const inputClass = 'w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a2e 0%, #0a0f1e 60%, #050810 100%)' }}>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}>
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My CFO</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Your private financial OS
          </p>
        </div>

        <div className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                  style={{
                    background: s <= step ? 'linear-gradient(135deg, #F97316, #ea580c)' : 'rgba(255,255,255,0.1)',
                    color: s <= step ? 'white' : 'rgba(255,255,255,0.4)',
                  }}>
                  {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 2 && <div className="h-px w-8 transition-all"
                  style={{ background: step > s ? '#F97316' : 'rgba(255,255,255,0.15)' }} />}
              </div>
            ))}
            <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Step {step} of 2
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>

                <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Start managing your finances privately
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Full Name</label>
                    <input type="text" placeholder="Rahul Sharma" value={form.full_name}
                      onChange={e => set('full_name', e.target.value)}
                      className={inputClass} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Email *</label>
                    <input type="email" placeholder="you@example.com" value={form.email} required
                      onChange={e => set('email', e.target.value)}
                      className={inputClass} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Username *</label>
                    <input type="text" placeholder="rahul_sharma" value={form.username} required
                      onChange={e => set('username', e.target.value.toLowerCase())}
                      className={inputClass} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Lowercase letters, digits, underscores only
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Password *</label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.password} required
                        onChange={e => set('password', e.target.value)}
                        className={`${inputClass} pr-11`} style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
                      <button type="button" onClick={() => setShowPwd(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={form.password} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>

                <h2 className="text-lg font-semibold text-white mb-1">Financial preferences</h2>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Customize your financial workspace
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Phone (optional)</label>
                    <input type="tel" placeholder="+91 98765 43210" value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      className={inputClass} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Country</label>
                      <select value={form.country} onChange={e => set('country', e.target.value)}
                        className={inputClass} style={{ ...inputStyle, appearance: 'none' }}>
                        {COUNTRIES.map(c => (
                          <option key={c.code} value={c.code} style={{ background: '#0a0f1e' }}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Currency</label>
                      <select value={form.currency} onChange={e => set('currency', e.target.value)}
                        className={inputClass} style={{ ...inputStyle, appearance: 'none' }}>
                        {CURRENCIES.map(c => (
                          <option key={c} value={c} style={{ background: '#0a0f1e' }}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <button type="submit" disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{
                      background: isLoading ? 'rgba(249,115,22,0.5)' : 'linear-gradient(135deg, #F97316, #ea580c)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}>
                    {isLoading
                      ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {error && step === 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm mt-4"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="flex gap-3 mt-5">
            {step > 1 && (
              <button onClick={() => { setStep(1); setError('') }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === 1 && (
              <button onClick={goNext}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}>
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Already have an account?{' '}
              <Link href="/login" className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#F97316' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
