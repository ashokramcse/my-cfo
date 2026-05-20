'use client'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { MonthlyTrend } from '@/types'
import { formatCurrencyCompact } from '@/lib/utils'

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs min-w-[160px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      <div className="font-semibold mb-2" style={{ color: '#1C1410' }}>{label}</div>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="font-mono" style={{ color: '#1C1410' }}>{formatCurrencyCompact(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function SpendingChart({ data }: { data: MonthlyTrend[] }) {
  const sorted = [...data].reverse()
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={sorted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F97316" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#F97316" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gEmi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#2563EB" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#16A34A" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#16A34A" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE5" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#A8A29E', fontSize: 11 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrencyCompact}
          tick={{ fill: '#A8A29E', fontSize: 11 }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip content={<Tip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#78716C', paddingTop: 8 }}
          iconType="circle" iconSize={6}
        />
        <Area type="monotone" dataKey="spend"    name="Spend"    stroke="#F97316" fill="url(#gSpend)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="emi"      name="EMI"      stroke="#2563EB" fill="url(#gEmi)"   strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="payments" name="Payments" stroke="#16A34A" fill="url(#gPay)"   strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
