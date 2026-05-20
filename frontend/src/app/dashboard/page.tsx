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
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CreditCard, TrendingDown, Calendar, Users,
  AlertCircle, Zap, Star, ArrowUpRight, Bell, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardStats, Insight } from '@/types'

const SEVERITY_STYLE = {
  CRITICAL: { border: 'border-rose-500/25',  bg: 'bg-rose-500/8',   dot: 'bg-rose-400',  label: 'text-rose-400'  },
  WARNING:  { border: 'border-amber-500/25', bg: 'bg-amber-500/8',  dot: 'bg-amber-400', label: 'text-amber-400' },
  INFO:     { border: 'border-sky-500/25',   bg: 'bg-sky-500/8',    dot: 'bg-sky-400',   label: 'text-sky-400'   },
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
    refetchInterval: 60_000,
  })

  const { data: forecast } = useQuery({
    queryKey: ['emi-forecast'],
    queryFn: async () => (await emisApi.forecast(6)).data,
  })

  const { data: insights } = useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => (await insightsApi.list({ unread_only: true, limit: 5 })).data,
  })

  return (
    <AppShell>
      <div className="p-6 xl:p-8 max-w-[1440px] mx-auto">
        <PageHeader
          icon={LayoutDashboard}
          title="Financial Dashboard"
          subtitle={`Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
          actions={
            <Link href="/statements" className="btn-primary">
              <Zap className="w-4 h-4" /> Upload Statement
            </Link>
          }
        />

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : stats ? (
              <>
                <StatCard title="Outstanding" value={formatCurrencyCompact(stats.total_outstanding)}
                  subtitle={`${stats.utilization_pct}% utilized`} icon={CreditCard}
                  variant={stats.utilization_pct > 70 ? 'danger' : stats.utilization_pct > 40 ? 'warning' : 'success'} delay={0} />
                <StatCard title="Available Credit" value={formatCurrencyCompact(stats.total_available)}
                  subtitle={`of ${formatCurrencyCompact(stats.total_credit_limit)}`} icon={TrendingDown} variant="violet" delay={0.05} />
                <StatCard title="Monthly Spend" value={formatCurrencyCompact(stats.monthly_spend)}
                  subtitle="this month" icon={ArrowUpRight} delay={0.1} />
                <StatCard title="EMI Burden" value={formatCurrencyCompact(stats.monthly_emi_burden)}
                  subtitle={`${stats.emi_summary.active_count} active`} icon={Calendar}
                  variant={stats.monthly_emi_burden > 30000 ? 'warning' : 'default'} delay={0.15} />
                <StatCard title="Receivables" value={formatCurrencyCompact(stats.total_receivables)}
                  subtitle={`${stats.friend_receivables.length} people`} icon={Users}
                  variant={stats.total_receivables > 0 ? 'warning' : 'default'} delay={0.2} />
                <StatCard title="Reward Points" value={stats.reward_points_balance.toLocaleString('en-IN')}
                  subtitle={`₹${stats.cashback_earned_month} cashback`} icon={Star} variant="success" delay={0.25} />
              </>
            ) : null}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          <div className="xl:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="section-title">Spending Trend</h2>
                <p className="section-sub">6-month overview</p>
              </div>
              <Link href="/reports" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                Full report <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {isLoading
              ? <div className="h-[230px] rounded-xl bg-white/3 shimmer" style={{ backgroundSize: '200% 100%' }} />
              : <SpendingChart data={stats?.monthly_trends ?? []} />}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="section-title">Category Spend</h2>
                <p className="section-sub">This month</p>
              </div>
              <Link href="/transactions" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                All txns <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {stats?.category_spending?.length
              ? <CategoryChart data={stats.category_spending} />
              : <p className="text-sm text-muted-foreground text-center py-12">No transactions yet</p>}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* EMI Forecast */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">EMI Forecast</h2>
                <p className="section-sub">Next 6 months</p>
              </div>
              <Link href="/emis" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Manage</Link>
            </div>
            <EMIForecastChart data={forecast ?? []} />
          </div>

          {/* Upcoming dues */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Upcoming Dues</h2>
              <Link href="/cards" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">All cards</Link>
            </div>
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/3 shimmer" style={{ backgroundSize: '200% 100%' }} />
                ))
                : stats?.upcoming_dues.slice(0, 4).map((card) => (
                  <div key={card.card_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.025] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <CreditCard className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{card.nickname}</div>
                      <div className="text-xs text-muted-foreground">{card.bank_name} · Due {formatDate(card.next_due)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono font-semibold text-foreground">{formatCurrencyCompact(card.outstanding)}</div>
                      <div className={cn('text-xs font-medium',
                        card.utilization_pct > 70 ? 'text-rose-400' : card.utilization_pct > 40 ? 'text-amber-400' : 'text-emerald-400')}>
                        {card.utilization_pct}%
                      </div>
                    </div>
                  </div>
                ))
              }
              {!isLoading && !stats?.upcoming_dues.length && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No cards added yet</p>
                  <Link href="/cards" className="text-xs text-violet-400 mt-1 inline-block hover:underline">Add a card →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-violet-400" />
                <h2 className="section-title">Insights</h2>
                {!!stats?.unread_insights && (
                  <span className="text-[10px] font-bold bg-violet-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                    {stats.unread_insights}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2.5">
              {insights?.length
                ? insights.map((insight) => {
                  const s = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.INFO
                  return (
                    <motion.div key={insight.id}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      className={cn('p-3 rounded-xl border text-xs', s.border, s.bg)}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                        <span className={cn('font-semibold', s.label)}>{insight.title}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed pl-3">{insight.body}</p>
                    </motion.div>
                  )
                })
                : (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center text-balance">
                      No insights yet. Upload a statement to get started.
                    </p>
                  </div>
                )
              }
            </div>
          </div>
        </div>

        {/* Friend receivables */}
        {!!stats?.friend_receivables?.length && (
          <div className="card p-5 mt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Friend EMI Receivables</h2>
                <p className="section-sub">Outstanding collections</p>
              </div>
              <Link href="/friends" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                Full dashboard <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.friend_receivables.map((f) => (
                <div key={f.friend_id}
                  className="p-4 rounded-xl border border-border/50 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)' }}>
                      {f.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{f.name}</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground">{formatCurrencyCompact(f.total_pending)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">pending</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
