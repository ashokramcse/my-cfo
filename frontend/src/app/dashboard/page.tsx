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
import {
  LayoutDashboard, CreditCard, TrendingDown, Calendar, Users,
  AlertCircle, Zap, Star, ArrowUpRight, Bell, ChevronRight,
  TrendingUp, Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardStats, Insight } from '@/types'

const SEVERITY: Record<string, { dot: string; label: string; bg: string; border: string }> = {
  CRITICAL: { dot: '#EF4444', label: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  WARNING:  { dot: '#F59E0B', label: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  INFO:     { dot: '#3B82F6', label: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
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

  const showSkeletons = isLoading || !stats

  return (
    <AppShell>
      <PageHeader
        icon={LayoutDashboard}
        title="Financial Dashboard"
        subtitle={`Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
        actions={
          <Link href="/statements" className="btn-primary">
            <Zap className="w-3.5 h-3.5" strokeWidth={2.5} /> Upload Statement
          </Link>
        }
      />

      <div className="p-5 xl:p-6 max-w-[1440px] mx-auto">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {showSkeletons
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : (
              <>
                <StatCard
                  title="Outstanding"
                  value={formatCurrencyCompact(stats.total_outstanding)}
                  subtitle={`${stats.utilization_pct}% utilized`}
                  icon={CreditCard}
                  variant={stats.utilization_pct > 70 ? 'danger' : stats.utilization_pct > 40 ? 'warning' : 'success'}
                  delay={0}
                />
                <StatCard
                  title="Available Credit"
                  value={formatCurrencyCompact(stats.total_available)}
                  subtitle={`of ${formatCurrencyCompact(stats.total_credit_limit)}`}
                  icon={TrendingDown}
                  variant="info"
                  delay={0.04}
                />
                <StatCard
                  title="Monthly Spend"
                  value={formatCurrencyCompact(stats.monthly_spend)}
                  subtitle="this month"
                  icon={ArrowUpRight}
                  variant="default"
                  delay={0.08}
                />
                <StatCard
                  title="EMI Burden"
                  value={formatCurrencyCompact(stats.monthly_emi_burden)}
                  subtitle={`${stats.emi_summary.active_count} active EMIs`}
                  icon={Calendar}
                  variant={stats.monthly_emi_burden > 30000 ? 'warning' : 'default'}
                  delay={0.12}
                />
                <StatCard
                  title="Receivables"
                  value={formatCurrencyCompact(stats.total_receivables)}
                  subtitle={`${stats.friend_receivables.length} people`}
                  icon={Users}
                  variant={stats.total_receivables > 0 ? 'warning' : 'success'}
                  delay={0.16}
                />
                <StatCard
                  title="Reward Points"
                  value={stats.reward_points_balance.toLocaleString('en-IN')}
                  subtitle={`₹${stats.cashback_earned_month} cashback`}
                  icon={Star}
                  variant="success"
                  delay={0.2}
                />
              </>
            )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {/* Spending Trend */}
          <div className="xl:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Spending Trend</h2>
                <p className="section-sub">6-month overview</p>
              </div>
              <Link href="/reports"
                className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>
                Full report <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {showSkeletons
              ? <div className="h-[220px] rounded-xl shimmer" />
              : <SpendingChart data={stats.monthly_trends ?? []} />}
          </div>

          {/* Category Spend */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Category Spend</h2>
                <p className="section-sub">This month</p>
              </div>
              <Link href="/transactions"
                className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>
                All txns <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {showSkeletons
              ? <div className="h-[220px] rounded-xl shimmer" />
              : stats.category_spending?.length
                ? <CategoryChart data={stats.category_spending} />
                : <EmptyState icon={TrendingUp} message="No transactions yet" />
            }
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* EMI Forecast */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">EMI Forecast</h2>
                <p className="section-sub">Next 6 months</p>
              </div>
              <Link href="/emis" className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>Manage</Link>
            </div>
            {showSkeletons
              ? <div className="h-[190px] rounded-xl shimmer" />
              : <EMIForecastChart data={forecast ?? []} />}
          </div>

          {/* Upcoming dues */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Upcoming Dues</h2>
              <Link href="/cards" className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>All cards</Link>
            </div>
            <div className="space-y-2">
              {showSkeletons
                ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl shimmer" />
                ))
                : stats.upcoming_dues.length
                  ? stats.upcoming_dues.slice(0, 4).map((card) => (
                    <div key={card.card_id}
                      className="flex items-center gap-3 p-3 rounded-xl transition-colors cursor-default"
                      style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 icon-box-orange">
                        <CreditCard className="w-3.5 h-3.5" style={{ color: '#EA580C' }} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#18120E' }}>{card.nickname}</div>
                        <div className="text-xs" style={{ color: '#A09890' }}>{card.bank_name} · Due {formatDate(card.next_due)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-mono font-bold" style={{ color: '#18120E' }}>{formatCurrencyCompact(card.outstanding)}</div>
                        <div className="text-xs font-semibold"
                          style={{ color: card.utilization_pct > 70 ? '#DC2626' : card.utilization_pct > 40 ? '#D97706' : '#16A34A' }}>
                          {card.utilization_pct}%
                        </div>
                      </div>
                    </div>
                  ))
                  : <EmptyState icon={CreditCard} message="No cards added yet">
                      <Link href="/cards" className="text-xs font-semibold mt-1 inline-block" style={{ color: '#F97316' }}>Add a card →</Link>
                    </EmptyState>
              }
            </div>
          </div>

          {/* Insights */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4" style={{ color: '#F97316' }} strokeWidth={2} />
              <h2 className="section-title">AI Insights</h2>
              {!!stats?.unread_insights && (
                <span className="ml-auto text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                  style={{ background: '#F97316' }}>
                  {stats.unread_insights}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {showSkeletons
                ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)
                : insights?.length
                  ? insights.map((ins) => {
                    const s = SEVERITY[ins.severity] ?? SEVERITY.INFO
                    return (
                      <motion.div key={ins.id}
                        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-xl text-xs"
                        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                          <span className="font-semibold" style={{ color: s.label }}>{ins.title}</span>
                        </div>
                        <p className="leading-relaxed pl-3" style={{ color: '#6B6460' }}>{ins.body}</p>
                      </motion.div>
                    )
                  })
                  : <EmptyState icon={Bell} message="No insights yet. Upload a statement to get started." />
              }
            </div>
          </div>
        </div>

        {/* Friend receivables */}
        {!!stats?.friend_receivables?.length && (
          <div className="card p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Friend EMI Receivables</h2>
                <p className="section-sub">Outstanding collections</p>
              </div>
              <Link href="/friends" className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>
                Full dashboard <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.friend_receivables.map((f) => (
                <div key={f.friend_id}
                  className="p-4 rounded-xl transition-colors"
                  style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
                      {f.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: '#18120E' }}>{f.name}</span>
                  </div>
                  <div className="text-lg font-bold font-mono" style={{ color: '#18120E' }}>{formatCurrencyCompact(f.total_pending)}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#A09890' }}>pending</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}

function EmptyState({ icon: Icon, message, children }: {
  icon: React.ElementType
  message: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: '#FFF0E0', border: '1.5px solid #FDC888' }}>
        <Icon className="w-4 h-4" style={{ color: '#EA580C' }} strokeWidth={1.8} />
      </div>
      <p className="text-sm text-center text-balance" style={{ color: '#A09890' }}>{message}</p>
      {children}
    </div>
  )
}
