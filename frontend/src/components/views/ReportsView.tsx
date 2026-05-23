'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { CategoryChart } from '@/components/charts/CategoryChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi } from '@/lib/api'
import { formatCurrencyCompact } from '@/lib/utils'
import { BarChart3, TrendingUp, TrendingDown, CreditCard, Calendar, Building2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { DashboardStats } from '@/types'

type DateRange = 'this_month' | 'last_3m' | 'last_6m' | 'this_year'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  this_month: 'This Month',
  last_3m:    'Last 3 Months',
  last_6m:    'Last 6 Months',
  this_year:  'This Year',
}

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#EF4444']

export function ReportsView() {
  const [dateRange, setDateRange] = useState<DateRange>('last_6m')

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
  })

  const { data: spendingData } = useQuery({
    queryKey: ['spending', dateRange],
    queryFn: async () => {
      const months = dateRange === 'this_month' ? 1 : dateRange === 'last_3m' ? 3 : dateRange === 'last_6m' ? 6 : 12
      return (await reportsApi.spending({ months })).data
    },
  })

  const { data: forecast = [] } = useQuery({
    queryKey: ['emi-forecast', 12],
    queryFn: async () => (await emisApi.forecast(12)).data,
  })

  // Compute top merchants from category spending
  const topMerchants = (spendingData?.top_merchants || stats?.category_spending || []).slice(0, 10)

  // CC vs Bank split for pie chart
  const spendSplit = [
    { name: 'CC Spend', value: spendingData?.total_cc_spend || stats?.monthly_spend || 0 },
    { name: 'Bank Debits', value: spendingData?.total_bank_debit || 0 },
  ].filter((d) => d.value > 0)

  const monthlyTrends = stats?.monthly_trends ?? []
  const months = dateRange === 'this_month' ? 1 : dateRange === 'last_3m' ? 3 : dateRange === 'last_6m' ? 6 : 12
  const filteredTrends = monthlyTrends.slice(-months)

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        subtitle="Unified spending analytics across CC and banking"
        actions={
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
            {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: dateRange === range ? '#F97316' : 'transparent',
                  color: dateRange === range ? 'white' : '#6B6460',
                }}>
                {DATE_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto space-y-5">

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats ? (
            <>
              <StatCard title="Total Limit"   value={formatCurrencyCompact(Number(stats.total_credit_limit))} icon={CreditCard}  variant="violet"  delay={0}    />
              <StatCard title="Outstanding"   value={formatCurrencyCompact(Number(stats.total_outstanding))}  icon={TrendingUp}  variant={Number(stats.utilization_pct) > 70 ? 'danger' : 'default'} delay={0.05} />
              <StatCard title="Utilization"   value={`${Math.round(Number(stats.utilization_pct))}%`}        icon={TrendingDown} variant={Number(stats.utilization_pct) > 70 ? 'danger' : Number(stats.utilization_pct) > 40 ? 'warning' : 'success'} delay={0.1} />
              <StatCard title="Reward Points" value={stats.reward_points_balance.toLocaleString('en-IN')}    icon={Calendar}    variant="success" delay={0.15} />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kpi-card h-28 shimmer" />
            ))
          )}
        </div>

        {/* Spending Trend + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card p-5">
            <div className="mb-5">
              <h2 className="section-title">Monthly Spending Trend</h2>
              <p className="section-sub">Spend vs EMI vs Payments</p>
            </div>
            <SpendingChart data={filteredTrends} />
          </div>

          <div className="card p-5">
            <div className="mb-5">
              <h2 className="section-title">Category Breakdown</h2>
              <p className="section-sub">CC transactions</p>
            </div>
            {stats?.category_spending?.length
              ? <CategoryChart data={stats.category_spending} />
              : <p className="text-sm text-center py-12" style={{ color: '#A09890' }}>No data yet</p>
            }
          </div>
        </div>

        {/* Top Merchants + CC vs Bank Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Top merchants */}
          <div className="lg:col-span-2 card p-5">
            <h2 className="section-title mb-4">Top Merchants by Spend</h2>
            {topMerchants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #EDE8E2' }}>
                      <th className="text-left py-2 text-xs font-semibold" style={{ color: '#A09890' }}>#</th>
                      <th className="text-left py-2 text-xs font-semibold" style={{ color: '#A09890' }}>Merchant / Category</th>
                      <th className="text-right py-2 text-xs font-semibold" style={{ color: '#A09890' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMerchants.map((m: any, i: number) => (
                      <motion.tr key={i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        style={{ borderBottom: '1px solid #F3EDE7' }}>
                        <td className="py-2 text-xs font-medium" style={{ color: '#A09890' }}>{i + 1}</td>
                        <td className="py-2 font-medium" style={{ color: '#18120E' }}>{m.merchant || m.merchant_name || m.category || m.name || '—'}</td>
                        <td className="py-2 text-right font-mono font-semibold" style={{ color: '#18120E' }}>
                          {formatCurrencyCompact(m.total || m.total_spend || m.amount || m.value || 0)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-center py-12" style={{ color: '#A09890' }}>No merchant data yet</p>
            )}
          </div>

          {/* CC vs Bank spend pie */}
          <div className="card p-5">
            <h2 className="section-title mb-4">CC vs Bank Spend</h2>
            {spendSplit.length > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={spendSplit} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={4} dataKey="value">
                      {spendSplit.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2">
                  {spendSplit.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                        <span style={{ color: '#6B6460' }}>{item.name}</span>
                      </div>
                      <span className="font-semibold" style={{ color: '#18120E' }}>{formatCurrencyCompact(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-center py-12" style={{ color: '#A09890' }}>No spend data yet</p>
            )}
          </div>
        </div>

        {/* EMI forecast */}
        <div className="card p-5">
          <div className="mb-5">
            <h2 className="section-title">12-Month EMI Forecast</h2>
            <p className="section-sub">Future EMI obligations</p>
          </div>
          <EMIForecastChart data={forecast} />
        </div>

        {/* Monthly breakdown table */}
        {filteredTrends.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1.5px solid #EDE8E2' }}>
              <h2 className="section-title">Monthly Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Spend</th>
                    <th className="text-right">EMI</th>
                    <th className="text-right">Payments</th>
                    <th className="text-right">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredTrends].reverse().map((m: any, i: number) => (
                    <motion.tr key={m.month}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td className="font-medium">{m.month}</td>
                      <td className="text-right font-mono text-sm">{formatCurrencyCompact(m.spend)}</td>
                      <td className="text-right font-mono text-sm text-orange-500">{formatCurrencyCompact(m.emi)}</td>
                      <td className="text-right font-mono text-sm text-emerald-400">{formatCurrencyCompact(m.payments)}</td>
                      <td className="text-right font-mono text-sm text-rose-400">{formatCurrencyCompact(m.fees)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
