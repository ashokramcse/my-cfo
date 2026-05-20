'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { CreditCard, Zap, BarChart3, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const registerSchema = loginSchema.extend({
  email: z.string().email(),
  full_name: z.string().optional(),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

const features = [
  { icon: CreditCard, title: 'Multi-Card Intelligence', desc: 'Track all credit cards in one command center' },
  { icon: Zap, title: 'Smart EMI Tracking', desc: 'Personal & friend EMIs with auto forecasting' },
  { icon: BarChart3, title: 'Deep Analytics', desc: 'Spending patterns, cashflow & liability forecasts' },
  { icon: Users, title: 'Friend EMI Management', desc: 'Track who owes what with WhatsApp reminders' },
]

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { setTokens } = useAuthStore()

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const handleLogin = async (data: LoginForm) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      setTokens(res.data.access_token, res.data.refresh_token)
      router.push('/dashboard')
      toast.success('Welcome back!')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (data: RegisterForm) => {
    setLoading(true)
    try {
      await api.post('/auth/register', data)
      toast.success('Account created! Please log in.')
      setIsRegister(false)
    } catch {
      toast.error('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 60%), radial-gradient(circle at 80% 20%, #a855f7 0%, transparent 50%)' }} />

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CC-Bill</span>
          </div>
          <p className="text-indigo-300 text-sm">Personal Finance Intelligence Platform</p>
        </motion.div>

        <div className="relative z-10 space-y-6">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
              className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{f.title}</div>
                <div className="text-indigo-300/70 text-xs mt-0.5">{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="relative z-10 text-indigo-400/50 text-xs">Self-hosted · Open Source · Zero data leaks</p>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <div className="glass-card p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {isRegister ? 'Set up your financial command center' : 'Sign in to your financial dashboard'}
              </p>
            </div>

            {!isRegister ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <input {...loginForm.register('username')}
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="your_username" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <input {...loginForm.register('password')} type="password"
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <input {...registerForm.register('full_name')}
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="Your Name" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <input {...registerForm.register('email')} type="email"
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="you@email.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <input {...registerForm.register('username')}
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="your_username" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <input {...registerForm.register('password')} type="password"
                    className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Creating…' : 'Create Account'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-primary hover:underline">
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
