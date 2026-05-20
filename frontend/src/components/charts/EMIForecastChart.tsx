'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { formatCurrencyCompact } from '@/lib/utils'

interface ForecastMonth {
  month: string
  total: number
  emis: Array<{ id: string; product: string; amount: number }>
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ForecastMonth
  return (
    <div className="card p-3 text-xs min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div className="font-semibold text-foreground mb-2">{label}</div>
      <div className="text-muted-foreground mb-2">
        Total: <span className="text-foreground font-mono">{formatCurrencyCompact(d.total)}</span>
      </div>
      {d.emis.slice(0, 4).map((e) => (
        <div key={e.id} className="flex justify-between gap-3 mb-0.5">
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
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="total" radius={[5, 5, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={entry.month === today ? '#7C3AED' : 'rgba(124,58,237,0.25)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
