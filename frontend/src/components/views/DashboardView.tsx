'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { StatCard } from '@/components/ui/StatCard'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi, insightsApi, netWorthApi, incomeApi, goalsApi } from '@/lib/api'
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CreditCard, TrendingDown, Calendar, Users,
  Zap, Star, ArrowUpRight, Bell, ChevronRight,
  TrendingUp, Sparkles, DollarSign, Target, Landmark,
  BarChart3, Wallet, Shield, Building2, AlertCircle, X,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { DashboardStats, Insight } from '@/types'

const SEVERITY: Record<string, { dot: string; label: string; bg: string; border: string }> = {
  CRITICAL: { dot: '#EF4444', label: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  WARNING:  { dot: '#F59E0B', label: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  INFO:     { dot: '#3B82F6', label: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
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

const QUICK_ACTIONS = [
  { icon: TrendingUp, label: 'Net Worth',   view: 'net-worth'   as const, color: '#6366F1' },
  { icon: Landmark,   label: 'Banking',     view: 'banking'     as const, color: '#0EA5E9' },
  { icon: BarChart3,  label: 'Invest',      view: 'investments' as const, color: '#10B981' },
  { icon: Wallet,     label: 'Loans',       view: 'loans'       as const, color: '#F59E0B' },
  { icon: DollarSign, label: 'Income',      view: 'income'      as const, color: '#8B5CF6' },
  { icon: Target,     label: 'Goals',       view: 'goals'       as const, color: '#EC4899' },
  { icon: Shield,     label: 'Insurance',   view: 'insurance'   as const, color: '#EF4444' },
  { icon: Sparkles,   label: 'AI CFO',      view: 'ai-cfo'      as const, color: '#F97316' },
]

const MODULE_VIEW_MAP: Record<string, string> = {
  'bank account': 'banking',
  'income': 'income',
  'investment': 'investments',
  'insurance health': 'insurance',
  'insurance term': 'insurance',
  'goal': 'goals',
}

export function DashboardView() {
  const { setView } = useUIStore()
  const [time, setTime] = useState('')
  const [completenessHidden, setCompletenessHidden] = useState(false)
  useEffect(() => {
    const fmt = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    fmt()
    const t = setInterval(fmt, 60_000)
    return () => clearInterval(t)
  }, [])

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

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth'],
    queryFn: async () => (await netWorthApi.current()).data,
  })

  const { data: incomeIntel } = useQuery({
    queryKey: ['income-intelligence'],
    queryFn: async () => (await incomeApi.intelligence()).data,
  })

  const { data: goalIntel } = useQuery({
    queryKey: ['goal-intelligence'],
    queryFn: async () => (await goalsApi.intelligence()).data,
  })

  const completeness = (netWorth as any)?.profile_completeness
  const showSkeletons = isLoading || !stats

  const nwVal   = netWorth?.net_worth ?? 0
  const cashVal = netWorth?.bank_liquid ?? netWorth?.bank_total ?? 0
  const invVal  = netWorth?.investment_value ?? 0
  const debtVal = netWorth?.total_liabilities ?? 0

  const monthlyIncome = incomeIntel?.total_monthly_net ?? 0
  const activeGoals   = goalIntel?.active_count ?? 0
  const goalsPct      = goalIntel?.overall_pct ?? 0

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Financial Command Center"
        subtitle={time ? `Live · ${time}` : 'Your complete financial overview'}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setView('ai-cfo')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
              <Sparkles size={14} /> Ask AI CFO
            </button>
            <button onClick={() => setView('statements')} className="btn-primary">
              <Zap className="w-3.5 h-3.5" strokeWidth={2.5} /> Upload Statement
            </button>
          </div>
        }
      />

      <div className="p-3 sm:p-5 xl:p-6 max-w-[1440px] mx-auto space-y-4">

        {/* ── Profile Completeness Banner (D-15) ── */}
        {completeness && completeness.score < 100 && !completenessHidden && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: '#FFF8ED', border: '1.5px solid #FDC888' }}>
            <AlertCircle size={16} style={{ color: '#EA580C', marginTop: 2 }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>
                Profile {completeness.score}% complete
              </p>
              <p className="text-xs mt-0.5 mb-2" style={{ color: '#6B6460' }}>
                Add missing modules for better AI insights
              </p>
              <div className="flex flex-wrap gap-1.5">
                {completeness.missing_items.map((item: string) => (
                  <button key={item}
                    onClick={() => {
                      const v = MODULE_VIEW_MAP[item] || item.replace(/ /g, '-')
                      setView(v as any)
                    }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ background: '#F97316', color: 'white' }}>
                    + {item}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setCompletenessHidden(true)} className="text-amber-400 hover:text-amber-600">
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* ── Net Worth hero banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#1A0F0A 0%,#2D1810 50%,#1A0F0A 100%)' }}>
          {/* glow */}
          <div className="absolute inset-0 opacity-20"
            style={{ background: 'radial-gradient(ellipse at 30% 50%,#F9731650,transparent 70%)' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-widest mb-1">Total Net Worth</p>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                {formatCurrencyCompact(nwVal)}
              </p>
              <p className="text-xs text-amber-300/60 mt-1">All assets minus all liabilities</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Cash & Bank', val: cashVal,     color: '#34D399' },
                { label: 'Investments', val: invVal,      color: '#60A5FA' },
                { label: 'Total Debt',  val: debtVal,     color: '#F87171' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
                  <p className="text-base font-bold mt-0.5" style={{ color }}>{formatCurrencyCompact(val)}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Quick action modules (D-16: data-aware) ── */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {QUICK_ACTIONS.map(({ icon: Icon, label, view, color }, i) => {
            let subtitle = ''
            if (view === 'net-worth')   subtitle = formatCurrencyCompact(nwVal)
            if (view === 'banking')     subtitle = formatCurrencyCompact(cashVal)
            if (view === 'investments') subtitle = formatCurrencyCompact(invVal)
            if (view === 'loans')       subtitle = formatCurrencyCompact(debtVal)
            if (view === 'income')      subtitle = formatCurrencyCompact(monthlyIncome) + '/mo'
            if (view === 'goals')       subtitle = `${activeGoals} active`
            if (view === 'insurance')   subtitle = netWorth?.insurance?.has_health && netWorth?.insurance?.has_term ? '✓ covered' : '⚠ gaps'
            if (view === 'ai-cfo')      subtitle = 'Ask anything'
            return (
              <motion.button
                key={view}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setView(view)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border border-amber-100 bg-white hover:border-amber-300 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: color + '18' }}>
                  <Icon size={16} style={{ color }} strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-semibold text-amber-800 group-hover:text-amber-950">{label}</span>
                {subtitle && <span className="text-[9px] text-amber-500 font-medium truncate w-full text-center">{subtitle}</span>}
              </motion.button>
            )
          })}
        </div>

        {/* ── Credit card KPI row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {showSkeletons
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : (
              <>
                <StatCard
                  title="CC Outstanding"
                  value={formatCurrencyCompact(stats.total_outstanding)}
                  subtitle={`${stats.utilization_pct}% utilized`}
                  icon={CreditCard}
                  variant={Number(stats.utilization_pct) > 70 ? 'danger' : Number(stats.utilization_pct) > 40 ? 'warning' : 'success'}
                  delay={0}
                />
                <StatCard
                  title="Monthly Income"
                  value={formatCurrencyCompact(monthlyIncome)}
                  subtitle="net take-home"
                  icon={DollarSign}
                  variant="success"
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
                  variant={Number(stats.monthly_emi_burden) > 30000 ? 'warning' : 'default'}
                  delay={0.12}
                />
                <StatCard
                  title="Goals"
                  value={`${activeGoals} active`}
                  subtitle={`${goalsPct.toFixed(0)}% avg progress`}
                  icon={Target}
                  variant={goalsPct > 60 ? 'success' : 'default'}
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

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Spending Trend */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Spending Trend</h2>
                <p className="section-sub">6-month credit card spend</p>
              </div>
              <button onClick={() => setView('reports')}
                className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>
                Full report <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {showSkeletons
              ? <div className="h-[220px] rounded-xl shimmer" />
              : <SpendingChart data={stats.monthly_trends ?? []} />}
          </div>

          {/* EMI Forecast */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">EMI Forecast</h2>
                <p className="section-sub">Next 6 months</p>
              </div>
              <button onClick={() => setView('emis')} className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>Manage</button>
            </div>
            {showSkeletons
              ? <div className="h-[190px] rounded-xl shimmer" />
              : <EMIForecastChart data={forecast ?? []} />}
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming dues */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Upcoming Dues</h2>
              <button onClick={() => setView('cards')} className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>All cards</button>
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
                          style={{ color: Number(card.utilization_pct) > 70 ? '#DC2626' : Number(card.utilization_pct) > 40 ? '#D97706' : '#16A34A' }}>
                          {Math.round(Number(card.utilization_pct))}%
                        </div>
                      </div>
                    </div>
                  ))
                  : <EmptyState icon={CreditCard} message="No cards added yet">
                      <button onClick={() => setView('cards')} className="text-xs font-semibold mt-1 inline-block" style={{ color: '#F97316' }}>Add a card →</button>
                    </EmptyState>
              }
            </div>
          </div>

          {/* AI Insights */}
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
                  : <EmptyState icon={Bell} message="No insights yet. Upload a statement to get started.">
                      <button onClick={() => setView('ai-cfo')} className="text-xs font-semibold mt-1 inline-block" style={{ color: '#F97316' }}>Chat with AI CFO →</button>
                    </EmptyState>
              }
            </div>
          </div>

          {/* Goals summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Goals Progress</h2>
              <button onClick={() => setView('goals')} className="text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>All goals</button>
            </div>
            {goalIntel?.goals?.length
              ? (
                <div className="space-y-3">
                  {goalIntel.goals.slice(0, 4).map((g: { id: string; emoji: string; name: string; progress_pct: number; color: string; on_track: boolean }) => (
                    <div key={g.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-amber-900 truncate max-w-[60%]">{g.emoji} {g.name}</span>
                        <span className={cn('font-semibold', g.on_track ? 'text-emerald-600' : 'text-amber-500')}>
                          {g.progress_pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${Math.min(100, g.progress_pct)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: g.color || '#F97316' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )
              : <EmptyState icon={Target} message="No goals yet">
                  <button onClick={() => setView('goals')} className="text-xs font-semibold mt-1 inline-block" style={{ color: '#F97316' }}>Set a goal →</button>
                </EmptyState>
            }
          </div>
        </div>

        {/* Friend receivables */}
        {!!stats?.friend_receivables?.length && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Friend EMI Receivables</h2>
                <p className="section-sub">Outstanding collections</p>
              </div>
              <button onClick={() => setView('friends')} className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                style={{ color: '#F97316' }}>
                Full dashboard <ChevronRight className="w-3 h-3" />
              </button>
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
    </>
  )
}
