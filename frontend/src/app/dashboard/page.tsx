'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/ui/StatCard'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { CategoryChart } from '@/components/charts/CategoryChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi, insightsApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact, formatDate, riskBadge, utilizationBg } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CreditCard, TrendingDown, Calendar, Users,
  AlertCircle, Zap, Star, ArrowUpRight, Bell, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { DashboardStats, Insight } from '@/types'

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
    refetchInterval: 60_000,
  })

  const { data: emiforecast } = useQuery({
    queryKey: ['emi-forecast'],
    queryFn: async () => (await emisApi.forecast(6)).data,
  })

  const { data: insights } = useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => (await insightsApi.list({ unread_only: true, limit: 5 })).data,
  })

  return (
    <AppShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHeader
          icon={LayoutDashboard}
          title="Financial Command Center"
          subtitle={`Last updated ${new Date().toLocaleTimeString()}`}
          actions={
            <Link href="/statements" className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Zap className="w-4 h-4" /> Upload Statement
            </Link>
          }
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : stats ? (
            <>
              <StatCard title="Total Outstanding" value={formatCurrencyCompact(stats.total_outstanding)}
                subtitle={`${stats.utilization_pct}% utilized`} icon={CreditCard}
                variant={stats.utilization_pct > 70 ? 'danger' : stats.utilization_pct > 40 ? 'warning' : 'success'} delay={0} />
              <StatCard title="Available Credit" value={formatCurrencyCompact(stats.total_available)}
                subtitle={`of ${formatCurrencyCompact(stats.total_credit_limit)}`} icon={TrendingDown} variant="info" delay={0.05} />
              <StatCard title="Monthly Spend" value={formatCurrencyCompact(stats.monthly_spend)}
                subtitle="this month" icon={ArrowUpRight} delay={0.1} />
              <StatCard title="EMI Burden" value={formatCurrencyCompact(stats.monthly_emi_burden)}
                subtitle={`${stats.emi_summary.active_count} active EMIs`} icon={Calendar}
                variant={stats.monthly_emi_burden > 30000 ? 'warning' : 'default'} delay={0.15} />
              <StatCard title="Friend Receivables" value={formatCurrencyCompact(stats.total_receivables)}
                subtitle={`${stats.friend_receivables.length} people`} icon={Users}
                variant={stats.total_receivables > 0 ? 'warning' : 'default'} delay={0.2} />
              <StatCard title="Reward Points" value={stats.reward_points_balance.toLocaleString()}
                subtitle={`₹${stats.cashback_earned_month} cashback this month`} icon={Star} variant="success" delay={0.25} />
            </>
          ) : null}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Spending Trend */}
          <div className="xl:col-span-2 glass-card p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Spending Trend</h2>
                <p className="text-xs text-muted-foreground mt-0.5">6-month overview</p>
              </div>
            </div>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="w-full h-full rounded-xl bg-white/3 shimmer-bg" />
              </div>
            ) : (
              <SpendingChart data={stats?.monthly_trends ?? []} />
            )}
          </div>

          {/* Category Breakdown */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Category Spend</h2>
                <p className="text-xs text-muted-foreground mt-0.5">This month</p>
              </div>
              <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {stats?.category_spending ? (
              <CategoryChart data={stats.category_spending} />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* EMI Forecast */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">EMI Forecast</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Next 6 months</p>
              </div>
              <Link href="/emis" className="text-xs text-primary hover:underline">Manage</Link>
            </div>
            <EMIForecastChart data={emiforecast ?? []} />
          </div>

          {/* Upcoming Dues */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-foreground">Upcoming Dues</h2>
              <Link href="/cards" className="text-xs text-primary hover:underline">All cards</Link>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/3 shimmer-bg" />
                ))
              ) : stats?.upcoming_dues.slice(0, 4).map((card) => (
                <div key={card.card_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{card.nickname}</div>
                    <div className="text-xs text-muted-foreground">{card.bank_name} · Due {formatDate(card.next_due)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-foreground">{formatCurrencyCompact(card.outstanding)}</div>
                    <div className={cn('text-xs', card.utilization_pct > 70 ? 'text-danger' : card.utilization_pct > 40 ? 'text-warning' : 'text-success')}>
                      {card.utilization_pct}%
                    </div>
                  </div>
                </div>
              ))}
              {!isLoading && !stats?.upcoming_dues.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No cards added yet</p>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="glass-card p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Insights</h2>
                {!!stats?.unread_insights && (
                  <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">{stats.unread_insights}</span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {insights?.length ? insights.map((insight) => (
                <motion.div key={insight.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className={cn('p-3 rounded-xl border text-xs',
                    insight.severity === 'CRITICAL' ? 'border-danger/30 bg-danger/5' :
                    insight.severity === 'WARNING' ? 'border-warning/30 bg-warning/5' :
                    'border-info/30 bg-info/5'
                  )}>
                  <div className={cn('font-semibold mb-1',
                    insight.severity === 'CRITICAL' ? 'text-danger' :
                    insight.severity === 'WARNING' ? 'text-warning' : 'text-info'
                  )}>{insight.title}</div>
                  <div className="text-muted-foreground leading-relaxed">{insight.body}</div>
                </motion.div>
              )) : (
                <div className="text-center py-6 space-y-2">
                  <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No insights yet.<br />Upload a statement to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Friend EMI Receivables */}
        {stats?.friend_receivables && stats.friend_receivables.length > 0 && (
          <div className="glass-card p-5 mt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Friend EMI Receivables</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Outstanding collections</p>
              </div>
              <Link href="/friends" className="text-xs text-primary hover:underline flex items-center gap-1">
                Full dashboard <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.friend_receivables.map((f) => (
                <div key={f.friend_id} className="p-4 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {f.name[0]}
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{f.name}</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground">{formatCurrencyCompact(f.total_pending)}</div>
                  <div className="text-xs text-muted-foreground mt-1">pending</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
