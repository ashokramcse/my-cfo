'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { MonthlyTrend } from '@/types'
import { formatCurrencyCompact } from '@/lib/utils'

interface SpendingChartProps {
  data: MonthlyTrend[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 text-xs space-y-1 min-w-[140px]">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono text-foreground">{formatCurrencyCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function SpendingChart({ data }: SpendingChartProps) {
  const sorted = [...data].reverse()
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={sorted} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="emiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
        <Area type="monotone" dataKey="spend" name="Spend" stroke="#6366f1" fill="url(#spendGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="emi" name="EMI" stroke="#a855f7" fill="url(#emiGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="payments" name="Payments" stroke="#22c55e" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
