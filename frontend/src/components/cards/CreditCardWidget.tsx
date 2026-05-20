'use client'
import { motion } from 'framer-motion'
import { CreditCard } from '@/types'
import { formatCurrency, utilizationColor, BANK_COLORS } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreditCardWidgetProps {
  card: CreditCard
  onClick?: () => void
  delay?: number
}

export function CreditCardWidget({ card, onClick, delay = 0 }: CreditCardWidgetProps) {
  const colors = BANK_COLORS[card.bank_name.toUpperCase()] ?? BANK_COLORS.DEFAULT
  const utilization = card.credit_limit > 0 ? (card.current_outstanding / card.credit_limit) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className="credit-card cursor-pointer"
      style={{
        '--card-from': colors.from,
        '--card-to': colors.to,
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%), linear-gradient(135deg, ${card.card_color}22, transparent)`,
      } as React.CSSProperties}
    >
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
        style={{ background: card.card_color, transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10"
        style={{ background: card.card_color, transform: 'translate(-30%, 30%)' }} />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-white/60 text-xs uppercase tracking-widest">{card.bank_name}</div>
            <div className="text-white font-semibold text-sm mt-0.5">{card.nickname}</div>
          </div>
          <Wifi className="w-5 h-5 text-white/50 rotate-90" />
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-5 rounded bg-yellow-400/80 flex items-center justify-center">
            <div className="w-4 h-3 rounded border border-yellow-600/50 bg-gradient-to-b from-yellow-300/50 to-transparent" />
          </div>
          <span className="text-white/80 font-mono text-sm tracking-[0.2em]">•••• •••• •••• {card.last_four}</span>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <div className="text-white/50 text-xs mb-1">Outstanding</div>
            <div className="text-white font-bold text-lg font-mono">{formatCurrency(card.current_outstanding)}</div>
          </div>
          <div className="text-right">
            <div className="text-white/50 text-xs mb-1">Limit</div>
            <div className="text-white/80 text-sm font-mono">{formatCurrency(card.credit_limit)}</div>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span>Utilization</span>
            <span className={cn(utilizationColor(utilization))}>{utilization.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(utilization, 100)}%` }}
              transition={{ delay: delay + 0.3, duration: 0.6, ease: 'easeOut' }}
              className={cn('h-full rounded-full', utilization >= 80 ? 'bg-danger' : utilization >= 50 ? 'bg-warning' : 'bg-success')}
            />
          </div>
        </div>

        {card.expiry_month && card.expiry_year && (
          <div className="mt-3 flex justify-between text-xs text-white/40">
            <span>VALID THRU</span>
            <span className="font-mono">{String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
