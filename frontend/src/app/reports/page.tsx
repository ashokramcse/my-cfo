'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { CategoryChart } from '@/components/charts/CategoryChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi } from '@/lib/api'
import { formatCurrencyCompact } from '@/lib/utils'
import { BarChart3, Download } from 'lucide-react'
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
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={BarChart3}
          title="Reports & Analytics"
          subtitle="Deep financial insights across all your cards and EMIs"
          actions={
            <button className="flex items-center gap-2 border border-border text-muted-foreground hover:text-foreground text-sm px-3 py-2 rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          }
        />

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats && [
            { label: 'Total Limit', value: formatCurrencyCompact(Number(stats.total_credit_limit)) },
            { label: 'Outstanding', value: formatCurrencyCompact(Number(stats.total_outstanding)) },
            { label: 'Utilization', value: `${stats.utilization_pct}%` },
            { label: 'Reward Points', value: stats.reward_points_balance.toLocaleString() },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
              <div className="text-xl font-bold font-mono text-foreground">{item.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Spending trend */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-5">6-Month Spending Trend</h2>
            <SpendingChart data={stats?.monthly_trends ?? []} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-5">Category Breakdown</h2>
              <CategoryChart data={stats?.category_spending ?? []} />
            </div>

            {/* Card utilization */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-5">Card Utilization</h2>
              <div className="space-y-4">
                {stats?.upcoming_dues.map((card) => (
                  <div key={card.card_id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{card.nickname}</span>
                      <span className="text-muted-foreground font-mono">
                        {formatCurrencyCompact(Number(card.outstanding))} / {formatCurrencyCompact(card.outstanding / (Number(card.utilization_pct) / 100 || 1))}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${card.utilization_pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${Number(card.utilization_pct) >= 80 ? 'bg-danger' : Number(card.utilization_pct) >= 50 ? 'bg-warning' : 'bg-success'}`} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 text-right">{card.utilization_pct}% used</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* EMI Forecast */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-5">12-Month EMI Liability Forecast</h2>
            <EMIForecastChart data={forecast} />
          </div>

          {/* Friend receivables */}
          {stats?.friend_receivables && stats.friend_receivables.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-5">Friend Receivable Analysis</h2>
              <div className="space-y-3">
                {stats.friend_receivables.map((f) => (
                  <div key={f.friend_id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {f.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{f.name}</span>
                        <span className="font-mono text-warning">{formatCurrencyCompact(Number(f.total_pending))}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-warning rounded-full"
                          style={{ width: `${Math.min(100, (Number(f.total_pending) / Number(stats.total_receivables)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
