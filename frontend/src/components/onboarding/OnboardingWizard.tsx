'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Landmark, DollarSign, CreditCard, ArrowRight, X, CheckCircle2, Sparkles } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'

const STEPS = [
  {
    icon: Landmark,
    iconColor: '#0EA5E9',
    iconBg: 'rgba(14,165,233,0.15)',
    title: 'Add Your Bank Account',
    description: 'Connect your savings, salary, or current account to track your cash flow and liquid wealth.',
    action: 'banking' as const,
    actionLabel: 'Add Bank Account',
    skip: true,
  },
  {
    icon: DollarSign,
    iconColor: '#10B981',
    iconBg: 'rgba(16,185,129,0.15)',
    title: 'Set Up Your Income',
    description: 'Add your salary or freelance income sources so AI CFO can calculate your savings rate and DTI.',
    action: 'income' as const,
    actionLabel: 'Add Income Source',
    skip: true,
  },
  {
    icon: CreditCard,
    iconColor: '#F97316',
    iconBg: 'rgba(249,115,22,0.15)',
    title: 'Add Your First Card',
    description: 'Track credit card spends, utilisation, and due dates — never miss a payment again.',
    action: 'cards' as const,
    actionLabel: 'Add Credit Card',
    skip: true,
  },
]

interface OnboardingWizardProps {
  onDismiss: () => void
}

export function OnboardingWizard({ onDismiss }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const { setView } = useUIStore()
  const { user } = useAuthStore()

  function goTo(view: typeof STEPS[number]['action']) {
    setView(view)
    onDismiss()
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else onDismiss()
  }

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight">
              Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}! 👋
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Set up your financial OS in 3 quick steps
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 pt-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1 transition-all duration-300"
              style={{ background: i <= step ? '#F97316' : 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="px-6 py-6"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: current.iconBg, border: `1px solid ${current.iconColor}22` }}
            >
              <Icon className="w-7 h-7" style={{ color: current.iconColor }} strokeWidth={1.7} />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#F97316' }}>
              Step {step + 1} of {STEPS.length}
            </div>
            <h3 className="text-white text-lg font-bold leading-snug mb-2">{current.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {current.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {current.skip && (
            <button
              onClick={next}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {step < STEPS.length - 1 ? 'Skip for now' : 'Maybe later'}
            </button>
          )}
          <button
            onClick={() => goTo(current.action)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}
          >
            {current.actionLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Already set up link */}
        {step === 0 && (
          <div className="px-6 pb-5 text-center">
            <button onClick={onDismiss} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              I already have data set up →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
