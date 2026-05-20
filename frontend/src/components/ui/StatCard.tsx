import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  delay?: number
}

const variantStyles = {
  default: 'border-white/10',
  success: 'border-success/20 bg-success/5',
  warning: 'border-warning/20 bg-warning/5',
  danger: 'border-danger/20 bg-danger/5',
  info: 'border-info/20 bg-info/5',
}

const variantIcon = {
  default: 'bg-white/5 text-muted-foreground',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-danger/20 text-danger',
  info: 'bg-info/20 text-info',
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn('stat-card', variantStyles[variant], className)}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</div>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', variantIcon[variant])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground font-mono">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </div>
      {trend && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-danger')}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </div>
      )}
    </motion.div>
  )
}
