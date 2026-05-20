'use client'
import { motion } from 'framer-motion'
import { CreditCard } from '@/types'
import { formatCurrency, BANK_COLORS } from '@/lib/utils'
import { Wifi } from 'lucide-react'

interface CreditCardWidgetProps {
  card: CreditCard
  onClick?: () => void
  delay?: number
}

export function CreditCardWidget({ card, onClick, delay = 0 }: CreditCardWidgetProps) {
  const colors = BANK_COLORS[card.bank_name.toUpperCase()] ?? BANK_COLORS.DEFAULT
  const utilization = card.credit_limit > 0
    ? (card.current_outstanding / card.credit_limit) * 100
    : 0
  const utilColor = utilization >= 80 ? '#EF4444' : utilization >= 50 ? '#F59E0B' : '#10B981'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
      whileHover={{ y: -6, scale: 1.01 }}
      onClick={onClick}
      className="cc-card"
      style={{
        background: `linear-gradient(145deg, ${colors.from} 0%, ${colors.to} 60%, ${card.card_color}18 100%)`,
      }}
    >
      {/* Decorative glow blobs */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${card.card_color}30, transparent 70%)` }} />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${colors.from}60, transparent 70%)` }} />

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Top row */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-[0.15em] font-medium">{card.bank_name}</div>
            <div className="text-white font-semibold text-sm mt-0.5">{card.nickname}</div>
          </div>
          <Wifi className="w-4 h-4 text-white/30 rotate-90" />
        </div>

        {/* Chip + number */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-6 rounded-md"
            style={{ background: 'linear-gradient(135deg, #d4a843, #f5d778, #b8841a)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
          <span className="text-white/70 font-mono text-sm tracking-[0.2em]">•••• •••• •••• {card.last_four}</span>
        </div>

        {/* Bottom */}
        <div>
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Outstanding</div>
              <div className="text-white font-bold text-lg font-mono leading-none">
                {formatCurrency(card.current_outstanding)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Limit</div>
              <div className="text-white/70 text-sm font-mono">{formatCurrency(card.credit_limit)}</div>
            </div>
          </div>

          <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
            <span>Utilization</span>
            <span style={{ color: utilColor }}>{utilization.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(utilization, 100)}%` }}
              transition={{ delay: delay + 0.4, duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: utilColor }}
            />
          </div>

          {card.expiry_month && card.expiry_year && (
            <div className="mt-2 flex justify-between text-[10px] text-white/30">
              <span>VALID THRU</span>
              <span className="font-mono">{String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
