'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { CategoryChart } from '@/components/charts/CategoryChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi } from '@/lib/api'
import { formatCurrencyCompact } from '@/lib/utils'
import { BarChart3, TrendingUp, TrendingDown, CreditCard, Calendar } from 'lucide-react'
import { DashboardStats } from '@/types'

export default function ReportsPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
  })
  const { data: forecast = [] } = useQuery({
    queryKey: ['emi-forecast'],
    queryFn: async () => (await emisApi.forecast(12)).data,
  })

  return (
    <AppShell>
      <div className="p-6 xl:p-8 max-w-[1200px] mx-auto">
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          subtitle="Deep financial insights across all cards and EMIs"
        />

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats ? (
            <>
              <StatCard title="Total Limit"    value={formatCurrencyCompact(Number(stats.total_credit_limit))} icon={CreditCard} variant="violet"  delay={0}    />
              <StatCard title="Outstanding"    value={formatCurrencyCompact(Number(stats.total_outstanding))}  icon={TrendingUp}  variant={stats.utilization_pct > 70 ? 'danger' : 'default'} delay={0.05} />
              <StatCard title="Utilization"    value={`${stats.utilization_pct}%`}                            icon={TrendingDown} variant={stats.utilization_pct > 70 ? 'danger' : stats.utilization_pct > 40 ? 'warning' : 'success'} delay={0.1} />
              <StatCard title="Reward Points"  value={stats.reward_points_balance.toLocaleString('en-IN')}    icon={Calendar}    variant="success" delay={0.15} />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kpi-card h-28 shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))
          )}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          <div className="xl:col-span-2 card p-5">
            <div className="mb-5">
              <h2 className="section-title">6-Month Spending Trend</h2>
              <p className="section-sub">Spend vs EMI vs Payments</p>
            </div>
            <SpendingChart data={stats?.monthly_trends ?? []} />
          </div>

          <div className="card p-5">
            <div className="mb-5">
              <h2 className="section-title">Category Breakdown</h2>
              <p className="section-sub">This month</p>
            </div>
            {stats?.category_spending?.length
              ? <CategoryChart data={stats.category_spending} />
              : <p className="text-sm text-muted-foreground text-center py-12">No data yet</p>
            }
          </div>
        </div>

        {/* EMI forecast - full width */}
        <div className="card p-5 mb-5">
          <div className="mb-5">
            <h2 className="section-title">12-Month EMI Forecast</h2>
            <p className="section-sub">Future EMI obligations</p>
          </div>
          <EMIForecastChart data={forecast} />
        </div>

        {/* Monthly breakdown table */}
        {stats?.monthly_trends && stats.monthly_trends.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h2 className="section-title">Monthly Summary</h2>
            </div>
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
                {[...stats.monthly_trends].reverse().map((m, i) => (
                  <motion.tr key={m.month}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td className="font-medium">{m.month}</td>
                    <td className="text-right font-mono text-sm">{formatCurrencyCompact(m.spend)}</td>
                    <td className="text-right font-mono text-sm text-violet-400">{formatCurrencyCompact(m.emi)}</td>
                    <td className="text-right font-mono text-sm text-emerald-400">{formatCurrencyCompact(m.payments)}</td>
                    <td className="text-right font-mono text-sm text-rose-400">{formatCurrencyCompact(m.fees)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
