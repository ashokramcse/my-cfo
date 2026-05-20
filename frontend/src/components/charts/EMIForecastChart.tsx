'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { formatCurrencyCompact } from '@/lib/utils'

interface ForecastMonth {
  month: string
  total: number
  emis: Array<{ id: string; product: string; amount: number }>
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload as ForecastMonth
  return (
    <div className="glass-card p-3 text-xs space-y-1 min-w-[180px]">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      <div className="text-muted-foreground">Total: <span className="text-foreground font-mono">{formatCurrencyCompact(data.total)}</span></div>
      {data.emis.slice(0, 4).map((e) => (
        <div key={e.id} className="flex justify-between gap-3">
          <span className="text-muted-foreground truncate max-w-[100px]">{e.product}</span>
          <span className="font-mono text-foreground">{formatCurrencyCompact(e.amount)}</span>
        </div>
      ))}
    </div>
  )
}

export function EMIForecastChart({ data }: { data: ForecastMonth[] }) {
  const today = new Date().toISOString().slice(0, 7)
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.month} fill={entry.month === today ? '#6366f1' : '#6366f133'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
