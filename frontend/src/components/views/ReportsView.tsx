'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SpendingChart } from '@/components/charts/SpendingChart'
import { CategoryChart } from '@/components/charts/CategoryChart'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { reportsApi, emisApi, transactionsApi, cardsApi, bankAccountsApi } from '@/lib/api'
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import {
  BarChart3, TrendingUp, TrendingDown, CreditCard, Calendar,
  RefreshCw, Layers, ShoppingBag, Sun, ArrowDownLeft,
  AlertTriangle, Landmark, Filter, X, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { DashboardStats } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart3 },
  { id: 'categories',  label: 'Categories',   icon: Layers },
  { id: 'merchants',   label: 'Merchants',    icon: ShoppingBag },
  { id: 'cards',       label: 'Cards',        icon: CreditCard },
  { id: 'transactions',label: 'Transactions', icon: ArrowUpRight },
  { id: 'banking',     label: 'Banking',      icon: Landmark },
  { id: 'patterns',    label: 'Patterns',     icon: Sun },
] as const
type Tab = typeof TABS[number]['id']

const QUICK_RANGES = [
  { label: 'This Month', months: 1 },
  { label: 'Last 3M',    months: 3 },
  { label: 'Last 6M',    months: 6 },
  { label: 'This Year',  months: 12 },
]

const PALETTE = ['#F97316','#3B82F6','#10B981','#8B5CF6','#EC4899','#F59E0B','#06B6D4','#EF4444','#84CC16','#FB923C']

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD: '🍔', SHOPPING: '🛍️', TRAVEL: '✈️', SUBSCRIPTION: '📺',
  UTILITIES: '💡', ENTERTAINMENT: '🎬', FUEL: '⛽', GROCERIES: '🛒',
  HEALTH: '💊', EDUCATION: '📚', FEES: '🏦', CASH_WITHDRAWAL: '💵',
  EMI: '📅', TRANSFER: '↔️', OTHER: '📦',
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function dateRangeParams(months: number) {
  const now = new Date()
  const from = new Date(now)
  from.setMonth(from.getMonth() - months)
  return {
    date_from: from.toISOString().split('T')[0],
    date_to: now.toISOString().split('T')[0],
  }
}

function pct_arrow(v: number | null) {
  if (v === null) return null
  if (v > 5) return { icon: ArrowUpRight, color: '#EF4444', label: `+${v}%` }
  if (v < -5) return { icon: ArrowDownRight, color: '#10B981', label: `${v}%` }
  return { icon: Minus, color: '#F59E0B', label: `${v > 0 ? '+' : ''}${v}%` }
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="section-title">{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  )
}

function EmptyBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-sm" style={{ color: '#A09890' }}>
      {msg}
    </div>
  )
}

function FilterBar({
  months, setMonths, cardId, setCardId, cards,
  showCategory, category, setCategory,
}: {
  months: number; setMonths: (n: number) => void
  cardId: string; setCardId: (s: string) => void
  cards: any[]
  showCategory?: boolean
  category?: string; setCategory?: (s: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Date range */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
        {QUICK_RANGES.map(({ label, months: m }) => (
          <button key={m} onClick={() => setMonths(m)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: months === m ? '#F97316' : 'transparent', color: months === m ? 'white' : '#6B6460' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Card filter */}
      <select value={cardId} onChange={e => setCardId(e.target.value)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
        style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
        <option value="">All Cards</option>
        {cards.map((c: any) => (
          <option key={c.id} value={c.id}>{c.nickname || c.bank_name}</option>
        ))}
      </select>

      {/* Category filter */}
      {showCategory && setCategory && (
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
          style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_EMOJI).map(c => (
            <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── Drill-down transaction drawer ──────────────────────────────────────────────

function TxDrawer({ title, filter, onClose }: {
  title: string
  filter: Record<string, unknown>
  onClose: () => void
}) {
  const { data } = useQuery({
    queryKey: ['tx-drill', filter],
    queryFn: async () => (await transactionsApi.list({ ...filter, page_size: 100 })).data,
  })
  const txs = data?.items ?? []
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="rounded-2xl overflow-hidden mt-3"
      style={{ border: '1.5px solid #EDE8E2', background: '#FFFDF9' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1.5px solid #EDE8E2' }}>
        <span className="text-sm font-bold" style={{ color: '#18120E' }}>{title}</span>
        <button onClick={onClose}><X size={14} style={{ color: '#A09890' }} /></button>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="data-table w-full text-xs">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t: any) => (
              <tr key={t.id}>
                <td style={{ color: '#6B6460' }}>{t.transaction_date?.slice(0, 10)}</td>
                <td className="font-medium max-w-[200px] truncate">{t.merchant_name || t.description}</td>
                <td style={{ color: '#A09890' }}>{CATEGORY_EMOJI[t.category] || ''} {t.category}</td>
                <td className="text-right font-mono font-semibold">{formatCurrencyCompact(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {txs.length === 0 && <EmptyBox msg="No transactions found" />}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ months }: { months: number }) {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
  })
  const { data: forecast = [] } = useQuery({
    queryKey: ['emi-forecast', 12],
    queryFn: async () => (await emisApi.forecast(12)).data,
  })
  const { data: mom = [] } = useQuery({
    queryKey: ['mom', months],
    queryFn: async () => (await transactionsApi.monthOverMonth({ months: months + 1 })).data,
  })

  const monthlyTrends = stats?.monthly_trends ?? []
  const filteredTrends = monthlyTrends.slice(-months)

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats ? (
          <>
            <StatCard title="Total Limit"   value={formatCurrencyCompact(Number(stats.total_credit_limit))} icon={CreditCard}  variant="violet"  delay={0} />
            <StatCard title="Outstanding"   value={formatCurrencyCompact(Number(stats.total_outstanding))}  icon={TrendingUp}  variant={Number(stats.utilization_pct) > 70 ? 'danger' : 'default'} delay={0.05} />
            <StatCard title="Utilization"   value={`${Math.round(Number(stats.utilization_pct))}%`}        icon={TrendingDown} variant={Number(stats.utilization_pct) > 70 ? 'danger' : Number(stats.utilization_pct) > 40 ? 'warning' : 'success'} delay={0.1} />
            <StatCard title="Reward Points" value={stats.reward_points_balance.toLocaleString('en-IN')}    icon={Calendar}    variant="success" delay={0.15} />
          </>
        ) : Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl shimmer" />)}
      </div>

      {/* Spending Trend + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <SectionTitle title="Monthly Spending Trend" sub="Spend vs EMI vs Payments" />
          <SpendingChart data={filteredTrends} />
        </div>
        <div className="card p-5">
          <SectionTitle title="Category Breakdown" sub="All CC transactions" />
          {stats?.category_spending?.length
            ? <CategoryChart data={stats.category_spending} />
            : <EmptyBox msg="No data yet" />}
        </div>
      </div>

      {/* Month-over-Month */}
      <div className="card p-5">
        <SectionTitle title="Month-over-Month Comparison" sub="Spend change % vs previous month" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">vs Prev Month</th>
              </tr>
            </thead>
            <tbody>
              {[...mom].reverse().map((m: any) => {
                const arrow = pct_arrow(m.change_pct)
                return (
                  <tr key={m.month}>
                    <td className="font-semibold">{m.month}</td>
                    <td className="text-right font-mono">{formatCurrencyCompact(m.total)}</td>
                    <td className="text-right">{m.count}</td>
                    <td className="text-right">
                      {arrow
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: arrow.color }}>
                            <arrow.icon size={12} /> {arrow.label}
                          </span>
                        : <span style={{ color: '#A09890' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {mom.length === 0 && <EmptyBox msg="No data yet" />}
        </div>
      </div>

      {/* EMI Forecast + Monthly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <SectionTitle title="12-Month EMI Forecast" sub="Future obligations" />
          <EMIForecastChart data={forecast} />
        </div>
        <div className="card p-5 overflow-hidden">
          <SectionTitle title="Monthly Summary" sub="Spend · EMI · Payments · Fees" />
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
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
                {[...filteredTrends].reverse().map((m: any) => (
                  <tr key={m.month}>
                    <td className="font-medium">{m.month}</td>
                    <td className="text-right font-mono text-sm">{formatCurrencyCompact(m.spend)}</td>
                    <td className="text-right font-mono text-sm text-orange-500">{formatCurrencyCompact(m.emi)}</td>
                    <td className="text-right font-mono text-sm text-emerald-500">{formatCurrencyCompact(m.payments)}</td>
                    <td className="text-right font-mono text-sm text-rose-400">{formatCurrencyCompact(m.fees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CATEGORIES
// ══════════════════════════════════════════════════════════════════════════════

function CategoriesTab({ months, cardId, cards }: { months: number; cardId: string; cards: any[] }) {
  const [drill, setDrill] = useState<string | null>(null)
  const params = { ...dateRangeParams(months), ...(cardId ? { card_id: cardId } : {}) }

  const { data: breakdown = [] } = useQuery({
    queryKey: ['cat-breakdown', months, cardId],
    queryFn: async () => (await transactionsApi.categoryBreakdown(params)).data,
  })
  const { data: mom = [] } = useQuery({
    queryKey: ['mom-cat', months, cardId],
    queryFn: async () => (await transactionsApi.monthOverMonth({ months, ...(cardId ? { card_id: cardId } : {}) })).data,
  })

  const pieData = breakdown.slice(0, 8).map((r: any, i: number) => ({
    name: r.category, value: r.amount, fill: PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie */}
        <div className="card p-5">
          <SectionTitle title="Spend by Category" sub="Click a row to see transactions" />
          {breakdown.length ? (
            <div className="flex gap-4">
              <ResponsiveContainer width="45%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={2} dataKey="value">
                    {pieData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1 overflow-y-auto max-h-52">
                {breakdown.map((r: any, i: number) => (
                  <button key={r.category} onClick={() => setDrill(drill === r.category ? null : r.category)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-amber-50"
                    style={{ background: drill === r.category ? '#FFF0E0' : 'transparent' }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="flex-1 text-left font-medium truncate">{CATEGORY_EMOJI[r.category] || ''} {r.category}</span>
                    <span className="font-mono font-semibold" style={{ color: '#18120E' }}>{formatCurrencyCompact(r.amount)}</span>
                    <span style={{ color: '#A09890' }}>{r.percentage}%</span>
                    <ChevronDown size={10} style={{ color: '#A09890', transform: drill === r.category ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </button>
                ))}
              </div>
            </div>
          ) : <EmptyBox msg="No category data" />}
        </div>

        {/* Bar chart */}
        <div className="card p-5">
          <SectionTitle title="Category Bar Chart" sub="Sorted by spend" />
          {breakdown.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdown.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3EDE8" />
                <XAxis type="number" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#6B6460' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {breakdown.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyBox msg="No data" />}
        </div>
      </div>

      {/* Drill-down */}
      <AnimatePresence>
        {drill && (
          <TxDrawer
            title={`${CATEGORY_EMOJI[drill] || ''} ${drill} transactions`}
            filter={{ ...params, category: drill }}
            onClose={() => setDrill(null)}
          />
        )}
      </AnimatePresence>

      {/* MoM per category trend */}
      <div className="card p-5">
        <SectionTitle title="Monthly Spend Trend" sub="Total spend per month" />
        {mom.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mom}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
              <Bar dataKey="total" fill="#F97316" radius={[4, 4, 0, 0]} name="Spend" />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyBox msg="No trend data" />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MERCHANTS
// ══════════════════════════════════════════════════════════════════════════════

function MerchantsTab({ months, cardId, cards }: { months: number; cardId: string; cards: any[] }) {
  const [drill, setDrill] = useState<string | null>(null)
  const params = { ...dateRangeParams(months), ...(cardId ? { card_id: cardId } : {}), limit: 20 }

  const { data: merchants = [] } = useQuery({
    queryKey: ['merchants', months, cardId],
    queryFn: async () => (await transactionsApi.merchantBreakdown(params)).data,
  })

  const top5 = merchants.slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart top 10 */}
        <div className="card p-5">
          <SectionTitle title="Top Merchants" sub="By total spend" />
          {merchants.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={merchants.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3EDE8" />
                <XAxis type="number" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="merchant" tick={{ fontSize: 10, fill: '#6B6460' }} axisLine={false} tickLine={false} width={75} />
                <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {merchants.slice(0, 10).map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyBox msg="No merchant data" />}
        </div>

        {/* Top 5 cards */}
        <div className="card p-5">
          <SectionTitle title="Top 5 Merchants" sub="Click to see all transactions" />
          <div className="space-y-2">
            {top5.map((m: any, i: number) => (
              <div key={m.merchant}>
                <button onClick={() => setDrill(drill === m.merchant ? null : m.merchant)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-amber-50"
                  style={{ background: drill === m.merchant ? '#FFF0E0' : '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: PALETTE[i % PALETTE.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold truncate" style={{ color: '#18120E' }}>{m.merchant}</div>
                    <div className="text-xs" style={{ color: '#A09890' }}>{CATEGORY_EMOJI[m.category] || ''} {m.category} · {m.count} txns</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold" style={{ color: '#18120E' }}>{formatCurrencyCompact(m.total)}</div>
                    <div className="text-xs" style={{ color: '#A09890' }}>{m.percentage}%</div>
                  </div>
                  <ChevronRight size={14} style={{ color: '#A09890' }} />
                </button>
                <AnimatePresence>
                  {drill === m.merchant && (
                    <TxDrawer
                      title={`${m.merchant} transactions`}
                      filter={{ ...params, search: m.merchant }}
                      onClose={() => setDrill(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full merchant table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1.5px solid #EDE8E2' }}>
          <h2 className="section-title">All Merchants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Merchant</th><th>Category</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Total</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m: any, i: number) => (
                <tr key={m.merchant}>
                  <td style={{ color: '#A09890' }}>{i + 1}</td>
                  <td className="font-medium">{m.merchant}</td>
                  <td style={{ color: '#6B6460' }}>{CATEGORY_EMOJI[m.category] || ''} {m.category}</td>
                  <td className="text-right">{m.count}</td>
                  <td className="text-right font-mono font-semibold">{formatCurrencyCompact(m.total)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#EDE8E2' }}>
                        <div className="h-full rounded-full" style={{ width: `${m.percentage}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                      <span className="text-xs" style={{ color: '#A09890' }}>{m.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {merchants.length === 0 && <EmptyBox msg="No merchant data" />}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CARDS
// ══════════════════════════════════════════════════════════════════════════════

function CardsTab({ months }: { months: number }) {
  const params = dateRangeParams(months)

  const { data: byCard = [] } = useQuery({
    queryKey: ['spend-by-card', months],
    queryFn: async () => (await transactionsApi.spendByCard(params)).data,
  })
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await reportsApi.dashboard()).data,
  })

  const upcomingDues = stats?.upcoming_dues ?? []

  return (
    <div className="space-y-5">
      {/* Bar chart */}
      <div className="card p-5">
        <SectionTitle title="Spend by Card" sub="Comparison across all cards" />
        {byCard.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCard}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
              <XAxis dataKey="card_name" tick={{ fontSize: 11, fill: '#6B6460' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} name="Spend">
                {byCard.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyBox msg="No card data" />}
      </div>

      {/* Card utilization grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {upcomingDues.map((card: any, i: number) => {
          const spendRow = byCard.find((b: any) => b.card_id === card.card_id)
          const util = Number(card.utilization_pct)
          const utColor = util > 70 ? '#EF4444' : util > 40 ? '#F59E0B' : '#10B981'
          return (
            <div key={card.card_id} className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: PALETTE[i % PALETTE.length] + '20' }}>
                  <CreditCard size={16} style={{ color: PALETTE[i % PALETTE.length] }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#18120E' }}>{card.nickname}</div>
                  <div className="text-xs" style={{ color: '#A09890' }}>{card.bank_name}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#6B6460' }}>Outstanding</span>
                  <span className="font-mono font-semibold" style={{ color: '#18120E' }}>{formatCurrencyCompact(card.outstanding)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#6B6460' }}>Utilization</span>
                  <span className="font-semibold" style={{ color: utColor }}>{Math.round(util)}%</span>
                </div>
                {spendRow && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#6B6460' }}>Spend ({QUICK_RANGES.find(r => r.months === months)?.label})</span>
                    <span className="font-mono font-semibold" style={{ color: '#18120E' }}>{formatCurrencyCompact(spendRow.total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#6B6460' }}>Due Date</span>
                  <span style={{ color: '#18120E' }}>{card.next_due ? new Date(card.next_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</span>
                </div>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: '#F3EDE8' }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(util, 100)}%`, background: utColor }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Spend share pie */}
      {byCard.length > 1 && (
        <div className="card p-5">
          <SectionTitle title="Spend Share by Card" sub="Who's doing the heavy lifting?" />
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="40%" height={180}>
              <PieChart>
                <Pie data={byCard} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  paddingAngle={3} dataKey="total" nameKey="card_name">
                  {byCard.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {byCard.map((c: any, i: number) => (
                <div key={c.card_id} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="flex-1 truncate font-medium" style={{ color: '#18120E' }}>{c.card_name}</span>
                  <span className="font-mono font-semibold">{formatCurrencyCompact(c.total)}</span>
                  <span className="text-xs" style={{ color: '#A09890' }}>{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: TRANSACTIONS (large, refunds, hidden charges)
// ══════════════════════════════════════════════════════════════════════════════

function TransactionsTab({ months, cardId, cards }: { months: number; cardId: string; cards: any[] }) {
  const [minAmount, setMinAmount] = useState(5000)
  const [subTab, setSubTab] = useState<'large' | 'refunds' | 'hidden'>('large')
  const dateParams = { ...dateRangeParams(months), ...(cardId ? { card_id: cardId } : {}) }

  const { data: large = [] } = useQuery({
    queryKey: ['large-tx', months, cardId, minAmount],
    queryFn: async () => (await transactionsApi.largeTransactions({ ...dateParams, min_amount: minAmount })).data,
    enabled: subTab === 'large',
  })
  const { data: refundsData } = useQuery({
    queryKey: ['refunds', months, cardId],
    queryFn: async () => (await transactionsApi.refunds(dateParams)).data,
    enabled: subTab === 'refunds',
  })
  const { data: hiddenData } = useQuery({
    queryKey: ['hidden', months, cardId],
    queryFn: async () => (await transactionsApi.hiddenCharges(dateParams)).data,
    enabled: subTab === 'hidden',
  })

  const subTabs = [
    { id: 'large' as const, label: 'Large Transactions', icon: ArrowUpRight },
    { id: 'refunds' as const, label: 'Refunds', icon: ArrowDownLeft },
    { id: 'hidden' as const, label: 'Hidden Charges', icon: AlertTriangle },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: subTab === id ? '#F97316' : 'white',
              color: subTab === id ? 'white' : '#6B6460',
              border: `1.5px solid ${subTab === id ? '#F97316' : '#EDE8E2'}`,
            }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Large Transactions */}
      {subTab === 'large' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold" style={{ color: '#18120E' }}>Show transactions above:</label>
              <div className="flex gap-2">
                {[1000, 2000, 5000, 10000, 25000].map(v => (
                  <button key={v} onClick={() => setMinAmount(v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: minAmount === v ? '#F97316' : '#FAF7F4', color: minAmount === v ? 'white' : '#6B6460', border: '1.5px solid #EDE8E2' }}>
                    ₹{(v / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
              <span className="ml-auto text-sm font-semibold" style={{ color: '#F97316' }}>
                {large.length} transactions · {formatCurrencyCompact(large.reduce((s: number, t: any) => s + t.amount, 0))} total
              </span>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {large.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ color: '#6B6460' }}>{t.date?.slice(0, 10)}</td>
                      <td className="font-medium">{t.merchant_name || t.description}</td>
                      <td style={{ color: '#A09890' }}>{CATEGORY_EMOJI[t.category] || ''} {t.category}</td>
                      <td className="text-right font-mono font-bold" style={{ color: '#EF4444' }}>{formatCurrencyCompact(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {large.length === 0 && <EmptyBox msg={`No transactions above ₹${minAmount.toLocaleString('en-IN')}`} />}
            </div>
          </div>
        </div>
      )}

      {/* Refunds */}
      {subTab === 'refunds' && (
        <div className="space-y-4">
          {refundsData && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Total Refunded</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#10B981' }}>{formatCurrencyCompact(refundsData.total_refunded)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Number of Refunds</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#18120E' }}>{refundsData.count}</p>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Merchant</th><th>Category</th><th className="text-right">Refund</th></tr>
                </thead>
                <tbody>
                  {refundsData?.transactions?.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ color: '#6B6460' }}>{t.date?.slice(0, 10)}</td>
                      <td className="font-medium">{t.merchant_name || t.description}</td>
                      <td style={{ color: '#A09890' }}>{CATEGORY_EMOJI[t.category] || ''} {t.category}</td>
                      <td className="text-right font-mono font-bold" style={{ color: '#10B981' }}>{formatCurrencyCompact(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!refundsData || refundsData.count === 0) && <EmptyBox msg="No refunds found" />}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Charges */}
      {subTab === 'hidden' && (
        <div className="space-y-4">
          {hiddenData && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Total Charges</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#EF4444' }}>{formatCurrencyCompact(hiddenData.total_charges)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Number of Charges</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#18120E' }}>{hiddenData.count}</p>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Type</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {hiddenData?.transactions?.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ color: '#6B6460' }}>{t.date?.slice(0, 10)}</td>
                      <td className="font-medium">{t.description}</td>
                      <td>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: '#FEF2F2', color: '#DC2626' }}>
                          {t.transaction_type}
                        </span>
                      </td>
                      <td className="text-right font-mono font-bold" style={{ color: '#EF4444' }}>{formatCurrencyCompact(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!hiddenData || hiddenData.count === 0) && <EmptyBox msg="No fees or interest charges found" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: BANKING (inflow / outflow)
// ══════════════════════════════════════════════════════════════════════════════

function BankingTab({ months }: { months: number }) {
  const { data: cashflow } = useQuery({
    queryKey: ['cashflow', months],
    queryFn: async () => (await bankAccountsApi.cashflow(months)).data,
  })

  const monthly = cashflow?.monthly_cashflow ?? []
  const insights = cashflow?.insights ?? []

  const BANK_COLORS = { inflow: '#10B981', outflow: '#EF4444', net: '#3B82F6' }

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      {cashflow && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Total Inflow</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#10B981' }}>{formatCurrencyCompact(cashflow.total_inflow ?? 0)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Total Outflow</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#EF4444' }}>{formatCurrencyCompact(cashflow.total_outflow ?? 0)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Avg Monthly In</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#18120E' }}>{formatCurrencyCompact(cashflow.monthly_avg_in ?? 0)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold" style={{ color: '#A09890' }}>Runway</p>
            <p className="text-xl font-bold mt-1" style={{ color: cashflow.runway_months > 6 ? '#10B981' : '#F59E0B' }}>
              {cashflow.runway_months?.toFixed(1) ?? '—'} mo
            </p>
          </div>
        </div>
      )}

      {/* Inflow/Outflow chart */}
      <div className="card p-5">
        <SectionTitle title="Monthly Inflow vs Outflow" sub="Bank transactions" />
        {monthly.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
              <Legend />
              <Bar dataKey="inflow"  fill={BANK_COLORS.inflow}  radius={[4, 4, 0, 0]} name="Inflow" />
              <Bar dataKey="outflow" fill={BANK_COLORS.outflow} radius={[4, 4, 0, 0]} name="Outflow" />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyBox msg="No bank transaction data. Import bank transactions to see cashflow." />}
      </div>

      {/* Net cashflow line */}
      {monthly.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Net Cash Flow Trend" sub="Inflow minus Outflow per month" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
              <Line type="monotone" dataKey="net" stroke={BANK_COLORS.net} strokeWidth={2} dot={{ r: 3 }} name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Cash Flow Insights" />
          <div className="space-y-2">
            {insights.map((ins: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: '#FFF8ED', border: '1.5px solid #FDC888' }}>
                <span className="text-base mt-0.5">💡</span>
                <p className="text-sm" style={{ color: '#18120E' }}>{ins.message || ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PATTERNS (day-of-week, weekend vs weekday)
// ══════════════════════════════════════════════════════════════════════════════

function PatternsTab({ months, cardId, cards }: { months: number; cardId: string; cards: any[] }) {
  const params = { ...dateRangeParams(months), ...(cardId ? { card_id: cardId } : {}) }

  const { data: dow = [] } = useQuery({
    queryKey: ['dow', months, cardId],
    queryFn: async () => (await transactionsApi.dayOfWeek(params)).data,
  })
  const { data: wvw } = useQuery({
    queryKey: ['wvw', months, cardId],
    queryFn: async () => (await transactionsApi.weekendVsWeekday(params)).data,
  })

  const maxDow = Math.max(...dow.map((d: any) => d.total), 1)

  return (
    <div className="space-y-5">
      {/* Weekend vs Weekday */}
      {wvw && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5">
            <SectionTitle title="Weekend vs Weekday Spend" sub="Where does money flow?" />
            <div className="space-y-4 mt-2">
              {[
                { label: '📅 Weekday', data: wvw.weekday, color: '#3B82F6' },
                { label: '🎉 Weekend', data: wvw.weekend, color: '#F97316' },
              ].map(({ label, data, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold" style={{ color: '#18120E' }}>{label}</span>
                    <span className="font-mono font-bold" style={{ color }}>{formatCurrencyCompact(data.total)}</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: '#F3EDE8' }}>
                    <div className="h-full rounded-full" style={{ width: `${data.percentage}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1" style={{ color: '#A09890' }}>
                    <span>{data.count} transactions</span>
                    <span>Avg {formatCurrencyCompact(data.avg_per_tx)}/tx · {data.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie split */}
          <div className="card p-5 flex flex-col items-center justify-center">
            <SectionTitle title="Spend Split" />
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Weekday', value: wvw.weekday.total },
                    { name: 'Weekend', value: wvw.weekend.total },
                  ]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={4} dataKey="value">
                  <Cell fill="#3B82F6" />
                  <Cell fill="#F97316" />
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrencyCompact(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Day-of-week heatmap / bar */}
      <div className="card p-5">
        <SectionTitle title="Spend by Day of Week" sub="Which day do you spend most?" />
        {dow.length ? (
          <>
            {/* Heatmap-style bars */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {dow.map((d: any) => {
                const intensity = d.total / maxDow
                const isWeekend = d.dow === 0 || d.dow === 6
                return (
                  <div key={d.day} className="flex flex-col items-center gap-1">
                    <div className="w-full rounded-xl transition-all" style={{
                      height: `${Math.max(20, intensity * 100)}px`,
                      background: isWeekend ? `rgba(249,115,22,${0.2 + intensity * 0.8})` : `rgba(59,130,246,${0.2 + intensity * 0.8})`,
                    }} />
                    <span className="text-xs font-semibold" style={{ color: isWeekend ? '#F97316' : '#6B6460' }}>{d.day}</span>
                    <span className="text-[10px]" style={{ color: '#A09890' }}>{formatCurrencyCompact(d.total)}</span>
                  </div>
                )
              })}
            </div>
            {/* Also a clean bar chart */}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE8" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B6460' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any, n: string) => [formatCurrencyCompact(v as number), n]} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Spend">
                  {dow.map((d: any, i: number) => (
                    <Cell key={i} fill={d.dow === 0 || d.dow === 6 ? '#F97316' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs mt-2 text-center" style={{ color: '#A09890' }}>
              🟠 Weekend &nbsp; 🔵 Weekday
            </p>
          </>
        ) : <EmptyBox msg="No transaction data" />}
      </div>

      {/* Transaction count by day */}
      <div className="card p-5">
        <SectionTitle title="Transaction Count by Day" sub="How often do you swipe?" />
        {dow.length ? (
          <div className="grid grid-cols-7 gap-3">
            {dow.map((d: any) => {
              const isWeekend = d.dow === 0 || d.dow === 6
              return (
                <div key={d.day} className="rounded-xl p-3 text-center"
                  style={{ background: isWeekend ? '#FFF0E0' : '#EFF6FF', border: `1.5px solid ${isWeekend ? '#FDC888' : '#BFDBFE'}` }}>
                  <div className="text-xs font-bold mb-1" style={{ color: isWeekend ? '#EA580C' : '#1D4ED8' }}>{d.day}</div>
                  <div className="text-lg font-bold" style={{ color: '#18120E' }}>{d.count}</div>
                  <div className="text-[10px]" style={{ color: '#A09890' }}>txns</div>
                </div>
              )
            })}
          </div>
        ) : <EmptyBox msg="No data" />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export function ReportsView() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [months, setMonths] = useState(6)
  const [cardId, setCardId] = useState('')

  const { data: cardsData = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data,
  })
  const cards = Array.isArray(cardsData) ? cardsData : []

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        subtitle="Deep-dive into your spending, patterns and cash flow"
      />

      <div className="p-3 sm:p-5 xl:p-6 max-w-[1400px] mx-auto space-y-4">

        {/* Tab nav */}
        <div className="flex gap-1 overflow-x-auto pb-1"
          style={{ borderBottom: '2px solid #EDE8E2' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all relative"
              style={{ color: activeTab === id ? '#F97316' : '#6B6460' }}>
              <Icon size={14} />
              {label}
              {activeTab === id && (
                <motion.div layoutId="tab-underline"
                  className="absolute bottom-[-2px] left-0 right-0 h-[2px] rounded-full"
                  style={{ background: '#F97316' }} />
              )}
            </button>
          ))}
        </div>

        {/* Global filters (shown for most tabs) */}
        {activeTab !== 'overview' && activeTab !== 'banking' && (
          <FilterBar
            months={months} setMonths={setMonths}
            cardId={cardId} setCardId={setCardId}
            cards={cards}
          />
        )}
        {activeTab === 'overview' && (
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
            {QUICK_RANGES.map(({ label, months: m }) => (
              <button key={m} onClick={() => setMonths(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: months === m ? '#F97316' : 'transparent', color: months === m ? 'white' : '#6B6460' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}>
            {activeTab === 'overview'     && <OverviewTab months={months} />}
            {activeTab === 'categories'  && <CategoriesTab months={months} cardId={cardId} cards={cards} />}
            {activeTab === 'merchants'   && <MerchantsTab months={months} cardId={cardId} cards={cards} />}
            {activeTab === 'cards'       && <CardsTab months={months} />}
            {activeTab === 'transactions' && <TransactionsTab months={months} cardId={cardId} cards={cards} />}
            {activeTab === 'banking'     && <BankingTab months={months} />}
            {activeTab === 'patterns'    && <PatternsTab months={months} cardId={cardId} cards={cards} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
