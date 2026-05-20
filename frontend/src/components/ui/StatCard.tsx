'use client'
import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  trend?: { value: number; label?: string }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
  className?: string
  delay?: number
  accent?: string
}

const VARIANT_CONFIG = {
  default:  { accent: 'rgba(255,255,255,0.06)', icon: 'bg-white/8 text-muted-foreground',     glow: '' },
  success:  { accent: '#10B981',               icon: 'bg-emerald-500/15 text-emerald-400',    glow: 'shadow-glow-green' },
  warning:  { accent: '#F59E0B',               icon: 'bg-amber-500/15 text-amber-400',        glow: '' },
  danger:   { accent: '#EF4444',               icon: 'bg-rose-500/15 text-rose-400',          glow: '' },
  info:     { accent: '#3B82F6',               icon: 'bg-sky-500/15 text-sky-400',            glow: '' },
  violet:   { accent: '#7C3AED',               icon: 'bg-violet-500/15 text-violet-400',      glow: 'shadow-glow-violet' },
}

export function StatCard({
  title, value, subtitle, icon: Icon, trend,
  variant = 'default', className, delay = 0, accent,
}: StatCardProps) {
  const cfg = VARIANT_CONFIG[variant]
  const accentColor = accent ?? (variant !== 'default' ? cfg.accent : undefined)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn('kpi-card', cfg.glow, className)}
    >
      {/* Left accent bar */}
      {accentColor && (
        <div
          className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
          style={{ background: accentColor, opacity: 0.8 }}
        />
      )}

      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none">
          {title}
        </p>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', cfg.icon)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-foreground font-mono tracking-tight leading-none mb-1">
        {value}
      </div>

      <div className="flex items-center justify-between mt-2">
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold ml-auto',
            trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400',
          )}>
            {trend.value >= 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            <span>{Math.abs(trend.value)}%</span>
            {trend.label && <span className="text-muted-foreground font-normal">{trend.label}</span>}
          </div>
        )}
      </div>
    </motion.div>
  )
}
