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
    <div className="card p-3 text-xs min-w-[180px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      <div className="font-semibold mb-2" style={{ color: '#1C1410' }}>{label}</div>
      <div className="mb-2" style={{ color: '#78716C' }}>
        Total: <span className="font-mono" style={{ color: '#1C1410' }}>{formatCurrencyCompact(d.total)}</span>
      </div>
      {d.emis.slice(0, 4).map((e) => (
        <div key={e.id} className="flex justify-between gap-3 mb-0.5">
          <span className="truncate max-w-[100px]" style={{ color: '#78716C' }}>{e.product}</span>
          <span className="font-mono" style={{ color: '#1C1410' }}>{formatCurrencyCompact(e.amount)}</span>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE5" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: '#A8A29E', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatCurrencyCompact} tick={{ fill: '#A8A29E', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<Tip />} cursor={{ fill: 'rgba(249,115,22,0.05)' }} />
        <Bar dataKey="total" radius={[5, 5, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={entry.month === today ? '#F97316' : '#FED7AA'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
