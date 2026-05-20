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
    <div className="card p-3 text-xs min-w-[160px]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="font-mono text-foreground">{formatCurrencyCompact(e.value)}</span>
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
            <stop offset="0%"   stopColor="#7C3AED" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gEmi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22D3EE" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10B981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrencyCompact}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip content={<Tip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', paddingTop: 8 }}
          iconType="circle" iconSize={6}
        />
        <Area type="monotone" dataKey="spend"    name="Spend"    stroke="#7C3AED" fill="url(#gSpend)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="emi"      name="EMI"      stroke="#22D3EE" fill="url(#gEmi)"   strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="payments" name="Payments" stroke="#10B981" fill="url(#gPay)"   strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
