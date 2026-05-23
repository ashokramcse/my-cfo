'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { reportsApi, emisApi, insightsApi, netWorthApi, incomeApi, goalsApi, loansApi } from '@/lib/api'
import { formatCurrencyCompact } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, CreditCard, DollarSign, Target,
  Landmark, BarChart3, Wallet, Shield, Sparkles, Star,
  Calendar, ArrowUpRight, ChevronRight, Bell, Zap,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { DashboardStats, Insight } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Gauge (semi-circle) ───────────────────────────────────────────────────────
function Gauge({ pct, label }: { pct: number; label: string }) {
  const r = 54; const cx = 70; const cy = 70
  const startAngle = Math.PI; const endAngle = 0
  const toXY = (a: number) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) })
  const s = toXY(startAngle); const e = toXY(endAngle)
  const filled = toXY(startAngle + (endAngle - startAngle) * (pct / 100) * -1 + Math.PI)
  const trackD = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`
  const fillAngle = Math.PI - (Math.PI * pct / 100)
  const f = toXY(fillAngle)
  const fillD = `M ${s.x} ${s.y} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${f.x} ${f.y}`
  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={82} viewBox="0 0 140 82">
        <path d={trackD} fill="none" stroke="#F3EDE8" strokeWidth={12} strokeLinecap="round" />
        <path d={fillD} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
      </svg>
      <div className="text-center -mt-6">
        <div className="text-2xl font-bold" style={{ color }}>{pct}<span className="text-base font-medium text-muted-foreground">%</span></div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ── Mini sparkline bar ────────────────────────────────────────────────────────
function TrendBadge({ up, pct }: { up: boolean; pct: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: up ? '#D1FAE5' : '#FEE2E2', color: up ? '#059669' : '#DC2626' }}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct}
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, trend, trendUp, onClick }: {
  title: string; value: string; sub: string
  icon: React.ElementType; color: string
  trend?: string; trendUp?: boolean
  onClick?: () => void
}) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl p-5 text-left w-full hover:shadow-md transition-shadow group"
      style={{ border: '1px solid #EDE8E2' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18' }}>
          <Icon size={18} style={{ color }} strokeWidth={1.8} />
        </div>
        {trend && <TrendBadge up={!!trendUp} pct={trend} />}
      </div>
      <div className="text-xl font-bold tracking-tight" style={{ color: '#18120E' }}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{title}</div>
      <div className="text-[11px] mt-0.5" style={{ color: '#A09890' }}>{sub}</div>
    </button>
  )
}

// ── Custom tooltip for bar chart ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          {formatCurrencyCompact(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Severity colours ──────────────────────────────────────────────────────────
const SEV: Record<string, { dot: string; label: string; bg: string }> = {
  CRITICAL: { dot: '#EF4444', label: '#B91C1C', bg: '#FEF2F2' },
  WARNING:  { dot: '#F59E0B', label: '#B45309', bg: '#FFFBEB' },
  INFO:     { dot: '#3B82F6', label: '#1D4ED8', bg: '#EFF6FF' },
}

const QUICK = [
  { icon: Landmark,   label: 'Banking',     view: 'banking'     as const, color: '#0EA5E9' },
  { icon: BarChart3,  label: 'Investments', view: 'investments' as const, color: '#10B981' },
  { icon: Wallet,     label: 'Loans',       view: 'loans'       as const, color: '#F59E0B' },
  { icon: DollarSign, label: 'Income',      view: 'income'      as const, color: '#8B5CF6' },
  { icon: Target,     label: 'Goals',       view: 'goals'       as const, color: '#EC4899' },
  { icon: Shield,     label: 'Insurance',   view: 'insurance'   as const, color: '#EF4444' },
  { icon: Star,       label: 'Rewards',     view: 'cards'       as const, color: '#F97316' },
  { icon: Sparkles,   label: 'AI CFO',      view: 'ai-cfo'      as const, color: '#7C3AED' },
]

export function DashboardView() {
  const { setView } = useUIStore()
  const [time, setTime] = useState('')
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('onboarding_dismissed') === '1'
    return false
  })
  function dismissOnboarding() { localStorage.setItem('onboarding_dismissed', '1'); setOnboardingDismissed(true) }

  useEffect(() => {
    const fmt = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    fmt(); const t = setInterval(fmt, 60_000); return () => clearInterval(t)
  }, [])

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
    refetchInterval: 60_000,
  })
  const { data: forecast } = useQuery({ queryKey: ['emi-forecast'], queryFn: async () => (await emisApi.forecast(6)).data })
  const { data: insights } = useQuery<Insight[]>({ queryKey: ['insights'], queryFn: async () => (await insightsApi.list({ unread_only: true, limit: 5 })).data })
  const { data: netWorth } = useQuery({ queryKey: ['net-worth'], queryFn: async () => (await netWorthApi.current()).data })
  const { data: incomeIntel } = useQuery({ queryKey: ['income-intelligence'], queryFn: async () => (await incomeApi.intelligence()).data })
  const { data: goalIntel } = useQuery({ queryKey: ['goal-intelligence'], queryFn: async () => (await goalsApi.intelligence()).data })
  const { data: loanSummary } = useQuery({ queryKey: ['loans-summary'], queryFn: async () => (await loansApi.summary()).data })

  const showOnboarding = !onboardingDismissed && netWorth && ((netWorth as any)?.profile_completeness?.score ?? 100) < 30

  const nwVal        = netWorth?.net_worth ?? 0
  const cashVal      = netWorth?.bank_liquid ?? netWorth?.bank_total ?? 0
  const invVal       = netWorth?.investment_value ?? 0
  const debtVal      = netWorth?.total_liabilities ?? 0
  const healthScore  = netWorth?.health_score ?? 0
  const monthlyIncome = incomeIntel?.total_monthly_net ?? 0
  const activeGoals  = goalIntel?.active_count ?? 0
  const goalsPct     = goalIntel?.overall_pct ?? 0
  const dtiPct       = (loanSummary as any)?.dti_pct ?? 0

  // Chart data — spending trend
  const chartData = (stats?.monthly_trends ?? []).map((m: any) => ({
    month: m.month ?? m.label,
    spend: m.total_spend ?? m.spend ?? 0,
    income: monthlyIncome,
  }))

  // Top transactions for table
  const upcomingDues = stats?.upcoming_dues ?? []

  return (
    <>
      <AnimatePresence>
        {showOnboarding && <OnboardingWizard onDismiss={dismissOnboarding} />}
      </AnimatePresence>

      <div className="p-4 sm:p-6 xl:p-8 max-w-[1600px] mx-auto" style={{ minHeight: '100vh' }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#18120E' }}>Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{time ? `Live · ${time}` : 'Your financial command center'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('statements')}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground bg-white border border-border hover:border-orange-300 transition-colors">
              <Zap size={14} /> Upload
            </button>
            <button onClick={() => setView('ai-cfo')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
              <Sparkles size={14} /> Ask AI CFO
            </button>
          </div>
        </div>

        {/* ── 3 KPI cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard
            title="Net Worth"
            value={formatCurrencyCompact(nwVal)}
            sub="Assets minus liabilities"
            icon={TrendingUp}
            color="#6366F1"
            trend="+2.4%"
            trendUp
            onClick={() => setView('net-worth')}
          />
          <KpiCard
            title="Monthly Income"
            value={formatCurrencyCompact(monthlyIncome)}
            sub="Net take-home this month"
            icon={DollarSign}
            color="#10B981"
            trend="+1.2%"
            trendUp
            onClick={() => setView('income')}
          />
          <KpiCard
            title="CC Outstanding"
            value={formatCurrencyCompact(stats?.total_outstanding ?? 0)}
            sub={`${stats?.utilization_pct ?? 0}% utilization`}
            icon={CreditCard}
            color={Number(stats?.utilization_pct ?? 0) > 70 ? '#EF4444' : '#F97316'}
            trend={`${stats?.utilization_pct ?? 0}%`}
            trendUp={false}
            onClick={() => setView('cards')}
          />
        </div>

        {/* ── Main 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Spending Chart */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold" style={{ color: '#18120E' }}>Spending Trend</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">6-month credit card spend</p>
                </div>
                <button onClick={() => setView('reports')}
                  className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-70"
                  style={{ color: '#F97316' }}>
                  Full report <ChevronRight size={12} />
                </button>
              </div>
              {isLoading
                ? <div className="h-[220px] rounded-xl shimmer" />
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={28} barCategoryGap="35%">
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#A09890' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(0) + 'L' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F97316', fillOpacity: 0.06, radius: 8 }} />
                      <Bar dataKey="spend" radius={[6, 6, 0, 0]} name="Spend">
                        {chartData.map((_: any, i: number) => (
                          <Cell key={i} fill={i === chartData.length - 1 ? '#F97316' : '#FDBA74'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Quick modules row */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {QUICK.map(({ icon: Icon, label, view, color }) => (
                <button key={view} onClick={() => setView(view)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white hover:shadow-md transition-all group"
                  style={{ border: '1px solid #EDE8E2' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '15' }}>
                    <Icon size={16} style={{ color }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                </button>
              ))}
            </div>

            {/* Upcoming dues table */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold" style={{ color: '#18120E' }}>Upcoming Dues</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Credit card payments due</p>
                </div>
                <button onClick={() => setView('cards')}
                  className="text-xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: '#F97316' }}>
                  All cards
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
              ) : upcomingDues.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['Card', 'Bank', 'Outstanding', 'Utilization', 'Due'].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold pb-3 pr-4"
                          style={{ color: '#A09890' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {upcomingDues.slice(0, 5).map((card: any) => {
                      const util = Number(card.utilization_pct)
                      const utilColor = util > 70 ? '#EF4444' : util > 40 ? '#F59E0B' : '#10B981'
                      return (
                        <tr key={card.card_id} className="group hover:bg-[#FAF7F4] rounded-xl transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: '#FFF0E0' }}>
                                <CreditCard size={12} style={{ color: '#EA580C' }} />
                              </div>
                              <span className="font-semibold truncate max-w-[120px]" style={{ color: '#18120E' }}>{card.nickname}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">{card.bank_name}</td>
                          <td className="py-3 pr-4 font-mono font-bold text-sm" style={{ color: '#18120E' }}>
                            {formatCurrencyCompact(card.outstanding)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#F3EDE8] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, background: utilColor }} />
                              </div>
                              <span className="text-xs font-semibold" style={{ color: utilColor }}>{Math.round(util)}%</span>
                            </div>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {card.next_due ? new Date(card.next_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FFF0E0' }}>
                    <CreditCard size={16} style={{ color: '#EA580C' }} />
                  </div>
                  <p className="text-sm text-muted-foreground">No cards added yet</p>
                  <button onClick={() => setView('cards')} className="text-xs font-semibold" style={{ color: '#F97316' }}>Add a card →</button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-5">

            {/* Health Score gauge */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold" style={{ color: '#18120E' }}>Financial Health</h2>
                <button onClick={() => setView('net-worth')} className="text-xs font-semibold hover:opacity-70" style={{ color: '#F97316' }}>···</button>
              </div>
              <div className="flex justify-center my-2">
                <Gauge pct={healthScore} label="Health Score" />
              </div>
              <p className="text-xs text-center text-muted-foreground mb-4">
                {healthScore >= 80 ? 'Excellent financial health 🎉' : healthScore >= 60 ? 'Good — room to improve' : 'Needs attention — review debt & savings'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Net Worth',    val: formatCurrencyCompact(nwVal),   color: '#6366F1' },
                  { label: 'Investments',  val: formatCurrencyCompact(invVal),  color: '#10B981' },
                  { label: 'Liquid Cash',  val: formatCurrencyCompact(cashVal), color: '#0EA5E9' },
                  { label: 'Total Debt',   val: formatCurrencyCompact(debtVal), color: '#EF4444' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: color + '0E' }}>
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-bold font-mono" style={{ color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={15} style={{ color: '#F97316' }} />
                <h2 className="text-base font-bold" style={{ color: '#18120E' }}>AI Insights</h2>
                {!!stats?.unread_insights && (
                  <span className="ml-auto text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                    style={{ background: '#F97316' }}>{stats.unread_insights}</span>
                )}
              </div>
              <div className="space-y-2">
                {!insights?.length ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Bell size={20} style={{ color: '#FDBA74' }} />
                    <p className="text-xs text-muted-foreground text-center">No insights yet.<br />Upload a statement to get started.</p>
                    <button onClick={() => setView('ai-cfo')} className="text-xs font-semibold mt-1" style={{ color: '#F97316' }}>Chat with AI CFO →</button>
                  </div>
                ) : insights.slice(0, 4).map((ins) => {
                  const s = SEV[ins.severity] ?? SEV.INFO
                  return (
                    <div key={ins.id} className="p-3 rounded-xl text-xs" style={{ background: s.bg }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                        <span className="font-semibold" style={{ color: s.label }}>{ins.title}</span>
                      </div>
                      <p className="leading-relaxed pl-3 text-muted-foreground line-clamp-2">{ins.body}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Goals progress */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: '#18120E' }}>Goals</h2>
                <button onClick={() => setView('goals')} className="text-xs font-semibold hover:opacity-70" style={{ color: '#F97316' }}>
                  All goals
                </button>
              </div>
              {goalIntel?.goals?.length ? (
                <div className="space-y-3">
                  {goalIntel.goals.slice(0, 4).map((g: any) => (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium truncate max-w-[70%]" style={{ color: '#18120E' }}>{g.emoji} {g.name}</span>
                        <span className="font-bold" style={{ color: g.on_track ? '#10B981' : '#F59E0B' }}>
                          {g.progress_pct?.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3EDE8' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, g.progress_pct ?? 0)}%`, background: g.color || '#F97316' }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between text-xs" style={{ color: '#A09890' }}>
                    <span>{activeGoals} active goals</span>
                    <span className="font-semibold" style={{ color: '#F97316' }}>{goalsPct.toFixed(0)}% avg progress</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Target size={20} style={{ color: '#FDBA74' }} />
                  <p className="text-xs text-muted-foreground">No goals set yet</p>
                  <button onClick={() => setView('goals')} className="text-xs font-semibold" style={{ color: '#F97316' }}>Set a goal →</button>
                </div>
              )}
            </div>

            {/* EMI summary */}
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #EDE8E2' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: '#18120E' }}>EMI Burden</h2>
                <button onClick={() => setView('emis')} className="text-xs font-semibold hover:opacity-70" style={{ color: '#F97316' }}>Manage</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Monthly EMI',   val: formatCurrencyCompact(stats?.monthly_emi_burden ?? 0), icon: Calendar, color: '#F59E0B' },
                  { label: 'Active EMIs',   val: `${stats?.emi_summary?.active_count ?? 0}`,             icon: ArrowUpRight, color: '#6366F1' },
                  { label: 'DTI Ratio',     val: dtiPct ? `${dtiPct}%` : '—',                           icon: TrendingDown, color: dtiPct > 35 ? '#EF4444' : '#10B981' },
                  { label: 'Reward Points', val: (stats?.reward_points_balance ?? 0).toLocaleString('en-IN'), icon: Star, color: '#EC4899' },
                ].map(({ label, val, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: color + '0E' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} style={{ color }} strokeWidth={2} />
                      <span className="text-[10px] font-semibold" style={{ color: '#A09890' }}>{label}</span>
                    </div>
                    <div className="text-sm font-bold font-mono" style={{ color: '#18120E' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
