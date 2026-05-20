'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CategorySpend } from '@/types'
import { CATEGORY_META, formatCurrencyCompact } from '@/lib/utils'

interface CategoryChartProps {
  data: CategorySpend[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const meta = CATEGORY_META[d.category] ?? CATEGORY_META.OTHER
  return (
    <div className="glass-card p-3 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span>{meta.icon}</span>
        <span className="font-semibold text-foreground">{meta.label}</span>
      </div>
      <div className="text-muted-foreground">{formatCurrencyCompact(d.amount)} · {d.percentage}%</div>
      <div className="text-muted-foreground">{d.count} transactions</div>
    </div>
  )
}

const RADIAN = Math.PI / 180
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
  if (percentage < 5) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>{percentage}%</text>
}

export function CategoryChart({ data }: CategoryChartProps) {
  const top8 = data.slice(0, 8)
  return (
    <div className="flex gap-6 items-center">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={top8} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
            dataKey="amount" labelLine={false} label={renderLabel}>
            {top8.map((entry) => {
              const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.OTHER
              return <Cell key={entry.category} fill={meta.color} />
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {top8.map((entry) => {
          const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.OTHER
          return (
            <div key={entry.category} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
              <span className="text-xs text-muted-foreground flex-1">{meta.icon} {meta.label}</span>
              <span className="text-xs font-mono text-foreground">{formatCurrencyCompact(entry.amount)}</span>
              <span className="text-xs text-muted-foreground w-8 text-right">{entry.percentage}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
