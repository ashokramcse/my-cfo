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
}

const VARIANT_CONFIG: Record<string, {
  cardClass: string
  iconBg: string
  iconColor: string
  iconBorder: string
  valueColor: string
}> = {
  default:  {
    cardClass: 'kpi-card kpi-orange',
    iconBg: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)',
    iconBorder: '#FDC888',
    iconColor: '#EA580C',
    valueColor: '#18120E',
  },
  success:  {
    cardClass: 'kpi-card kpi-success',
    iconBg: 'linear-gradient(135deg, #DCFCE7, #A7F3C0)',
    iconBorder: '#6EE7A0',
    iconColor: '#15803D',
    valueColor: '#18120E',
  },
  warning:  {
    cardClass: 'kpi-card kpi-warning',
    iconBg: 'linear-gradient(135deg, #FEF3C7, #FDE9A0)',
    iconBorder: '#FCD34D',
    iconColor: '#B45309',
    valueColor: '#18120E',
  },
  danger:   {
    cardClass: 'kpi-card kpi-danger',
    iconBg: 'linear-gradient(135deg, #FEE2E2, #FCCACA)',
    iconBorder: '#FCA5A5',
    iconColor: '#B91C1C',
    valueColor: '#18120E',
  },
  info:     {
    cardClass: 'kpi-card kpi-info',
    iconBg: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
    iconBorder: '#93C5FD',
    iconColor: '#1D4ED8',
    valueColor: '#18120E',
  },
  violet:   {
    cardClass: 'kpi-card kpi-orange',
    iconBg: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)',
    iconBorder: '#FDC888',
    iconColor: '#EA580C',
    valueColor: '#18120E',
  },
}

export function StatCard({
  title, value, subtitle, icon: Icon, trend,
  variant = 'default', className, delay = 0,
}: StatCardProps) {
  const cfg = VARIANT_CONFIG[variant]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn(cfg.cardClass, className)}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10.5px] font-bold uppercase leading-none" style={{ color: '#A09890', letterSpacing: '0.055em' }}>
          {title}
        </p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: cfg.iconBg,
              border: `1.5px solid ${cfg.iconBorder}`,
            }}>
            <Icon className="w-3.5 h-3.5" style={{ color: cfg.iconColor }} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className="text-[21px] font-bold font-mono leading-none mb-1"
        style={{ color: cfg.valueColor, letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}>
        {value}
      </div>

      <div className="flex items-center justify-between mt-2">
        {subtitle && (
          <p className="text-xs leading-none" style={{ color: '#A09890' }}>{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 text-xs font-semibold ml-auto"
            style={{ color: trend.value >= 0 ? '#15803D' : '#B91C1C' }}>
            {trend.value >= 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            <span>{Math.abs(trend.value)}%</span>
            {trend.label && <span className="font-normal" style={{ color: '#A09890' }}>{trend.label}</span>}
          </div>
        )}
      </div>
    </motion.div>
  )
}
