'use client'
import { CategorySpend } from '@/types'
import { CATEGORY_META, formatCurrencyCompact } from '@/lib/utils'

export function CategoryChart({ data }: { data: CategorySpend[] }) {
  const top = data.slice(0, 7).map((e) => ({ ...e, amount: Number(e.amount), percentage: Number(e.percentage) }))
  const max = top[0]?.amount ?? 1

  return (
    <div className="space-y-3">
      {top.map((entry) => {
        const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.OTHER
        const pct = (entry.amount / max) * 100
        return (
          <div key={entry.category}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">{meta.icon}</span>
                <span className="text-xs text-foreground font-medium">{meta.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{entry.count} txns</span>
                <span className="text-xs font-mono font-semibold text-foreground w-14 text-right">
                  {formatCurrencyCompact(entry.amount)}
                </span>
                <span className="text-2xs text-muted-foreground w-7 text-right">{Math.round(entry.percentage)}%</span>
              </div>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${pct}%`,
                  background: meta.color,
                  opacity: 0.85,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        )
      })}
      {top.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No spending data yet</p>
      )}
    </div>
  )
}
