'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  RefreshCw, TrendingUp, CreditCard, Package, Shield, Zap,
  Users, DollarSign, ChevronRight, Calendar, AlertTriangle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { format, parseISO, isValid } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecurringItem {
  id: string
  name: string
  amount: number
  frequency: string
  next_date: string | null
  source: string
  emoji: string
  status: string
}

interface RecurringGroup {
  id: string
  label: string
  emoji: string
  color: string
  monthly: number
  items: RecurringItem[]
}

interface RecurringSummary {
  total_monthly: number
  total_annual: number
  groups: RecurringGroup[]
  upcoming: RecurringItem[]
  monthly_forecast: { month: string; total: number }[]
  burden_pct: number
  health: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FREQ_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUAL: 'Annual',
  WEEKLY: 'Weekly', YEARLY: 'Annual', SEMI_ANNUAL: 'Half-yearly',
}

const FREQ_COLORS: Record<string, { bg: string; text: string }> = {
  MONTHLY:     { bg: '#FFF7ED', text: '#C2410C' },
  QUARTERLY:   { bg: '#EFF6FF', text: '#1D4ED8' },
  ANNUAL:      { bg: '#F0FDF4', text: '#15803D' },
  YEARLY:      { bg: '#F0FDF4', text: '#15803D' },
  WEEKLY:      { bg: '#FDF4FF', text: '#7E22CE' },
  SEMI_ANNUAL: { bg: '#ECFDF5', text: '#065F46' },
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  investments: TrendingUp,
  emis:        CreditCard,
  loans:       DollarSign,
  insurance:   Shield,
  subscriptions: Package,
  utilities:   Zap,
  friends:     Users,
}

function freqBadge(frequency: string) {
  const label = FREQ_LABELS[frequency] ?? frequency
  const colors = FREQ_COLORS[frequency] ?? { bg: '#F5F5F4', text: '#57534E' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: colors.bg, color: colors.text }}>
      {label}
    </span>
  )
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? format(d, 'dd MMM') : '—'
  } catch {
    return '—'
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4',
  icon: Icon, delay = 0,
}: {
  label: string; value: string; sub?: string; color?: string; bg?: string
  border?: string; icon?: React.ElementType; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: bg, border: `1.5px solid ${border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-50" style={{ color }} />}
      </div>
      <span className="text-xl font-extrabold font-mono leading-none"
        style={{ color, letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </motion.div>
  )
}

function HealthBadge({ health }: { health: string }) {
  const cfg = health === 'HEALTHY'
    ? { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E', label: 'Healthy' }
    : health === 'MODERATE'
    ? { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B', label: 'Moderate' }
    : { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', dot: '#EF4444', label: 'Stressed' }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
      className="flex items-center justify-center"
    >
      <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
        <span className="text-sm font-bold" style={{ color: cfg.text }}>
          Commitment Health: {cfg.label}
        </span>
      </div>
    </motion.div>
  )
}

function GroupCard({ group, index }: { group: RecurringGroup; index: number }) {
  const Icon = GROUP_ICONS[group.id] ?? RefreshCw
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.07 }}
      className="card overflow-hidden"
    >
      {/* Color strip */}
      <div className="h-1 w-full" style={{ background: group.color }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${group.color}18`, border: `1.5px solid ${group.color}40` }}>
            <Icon className="w-4 h-4" style={{ color: group.color }} />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground">{group.emoji} {group.label}</span>
            <p className="text-[11px] text-muted-foreground">{group.items.length} commitment{group.items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold font-mono text-foreground"
            style={{ letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
            ₹{formatCurrencyCompact(group.monthly)}
          </div>
          <div className="text-[10px] text-muted-foreground">per month</div>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-border/30">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FFF8F4] transition-colors">
            <span className="text-lg w-7 text-center flex-shrink-0">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                {freqBadge(item.frequency)}
              </div>
              {item.next_date && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Next: {fmtDate(item.next_date)}</span>
                </div>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-foreground flex-shrink-0"
              style={{ fontFeatureSettings: '"tnum" 1' }}>
              ₹{formatCurrencyCompact(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function UpcomingSection({ items }: { items: RecurringItem[] }) {
  if (!items.length) return null

  // Group by date
  const byDate = items.reduce<Record<string, RecurringItem[]>>((acc, item) => {
    const key = item.next_date ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const sortedDates = Object.keys(byDate).sort()

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFD9B0)', border: '1.5px solid #FED7AA' }}>
          <Calendar className="w-3.5 h-3.5 text-orange-500" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Upcoming in 30 Days</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
          {items.length} due
        </span>
      </div>

      <div className="card divide-y divide-border/40">
        {sortedDates.map((dateStr) => (
          <div key={dateStr}>
            <div className="px-4 py-2 bg-[#FFF8F4]">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                {dateStr !== 'Unknown' ? format(parseISO(dateStr), 'EEEE, d MMMM') : 'Date Unknown'}
              </span>
            </div>
            {byDate[dateStr].map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FFF8F4] transition-colors">
                <span className="text-base w-6 text-center flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{item.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {freqBadge(item.frequency)}
                    <span className="text-[11px] text-muted-foreground capitalize">{item.source}</span>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-foreground"
                  style={{ fontFeatureSettings: '"tnum" 1' }}>
                  ₹{formatCurrencyCompact(item.amount)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function ForecastChart({ data }: { data: { month: string; total: number }[] }) {
  if (!data.length) return null

  const maxVal = Math.max(...data.map(d => d.total))

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFD9B0)', border: '1.5px solid #FED7AA' }}>
          <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Monthly Forecast</h3>
        <span className="text-[10px] text-muted-foreground">Next {data.length} months</span>
      </div>

      <div className="card p-5">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => formatCurrencyCompact(v)}
              tick={{ fontSize: 10, fill: '#A09890' }}
              axisLine={false} tickLine={false} width={52}
            />
            <Tooltip
              formatter={(v: number) => [`₹${formatCurrencyCompact(v)}`, 'Total Commitments']}
              contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => {
                const intensity = maxVal > 0 ? entry.total / maxVal : 0
                const alpha = Math.round(0.4 + intensity * 0.6 * 255).toString(16).padStart(2, '0')
                return <Cell key={index} fill={`#F97316${alpha}`} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
          <span className="text-muted-foreground">Peak month: ₹{formatCurrencyCompact(maxVal)}</span>
          <span className="text-muted-foreground">
            Avg: ₹{formatCurrencyCompact(data.reduce((s, d) => s + d.total, 0) / data.length)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RecurringView() {
  const { data, isLoading } = useQuery<RecurringSummary>({
    queryKey: ['recurring-summary'],
    queryFn: async () => (await api.get('/recurring/summary')).data,
  })

  const burdenColor = !data ? '#18120E'
    : data.burden_pct > 75 ? '#B91C1C'
    : data.burden_pct > 50 ? '#B45309'
    : '#15803D'
  const burdenBg = !data ? '#FFF8F4'
    : data.burden_pct > 75 ? '#FEF2F2'
    : data.burden_pct > 50 ? '#FFFBEB'
    : '#F0FDF4'
  const burdenBorder = !data ? '#F0EAE4'
    : data.burden_pct > 75 ? '#FECACA'
    : data.burden_pct > 50 ? '#FDE68A'
    : '#BBF7D0'

  const activeGroups = (data?.groups ?? []).filter(g => g.items.length > 0)
  const isEmpty = !isLoading && activeGroups.length === 0

  return (
    <>
      <PageHeader
        icon={RefreshCw}
        title="Recurring"
        subtitle="Monthly commitments & financial obligations"
      />

      <div className="p-3 sm:p-5 xl:p-6 max-w-[1280px] mx-auto space-y-5">

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-warm-100 rounded-2xl h-20"
                  style={{ background: '#FFF1E6' }} />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl h-32"
                style={{ background: '#FFF1E6' }} />
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, #FFF7ED, #FED7AA)', border: '2px solid #FDBA74' }}>
              🔁
            </div>
            <div className="text-center max-w-xs">
              <p className="text-sm font-semibold text-foreground">No recurring commitments found</p>
              <p className="text-xs mt-2 text-muted-foreground leading-relaxed">
                Add investments, EMIs, subscriptions, or insurance to see them here.
              </p>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────── */}
        {data && !isEmpty && (
          <>
            {/* ── KPI Strip ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                label="Total Monthly"
                value={`₹${formatCurrencyCompact(data.total_monthly)}`}
                sub="All recurring obligations"
                color="#F97316" bg="#FFF7ED" border="#FED7AA"
                icon={RefreshCw} delay={0}
              />
              <MetricTile
                label="Annual Committed"
                value={`₹${formatCurrencyCompact(data.total_annual)}`}
                sub={`${formatCurrency(data.total_annual)} per year`}
                color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                icon={TrendingUp} delay={0.06}
              />
              <MetricTile
                label="Income Burden"
                value={`${data.burden_pct.toFixed(1)}%`}
                sub={data.burden_pct > 75 ? 'Over-committed' : data.burden_pct > 50 ? 'Moderate load' : 'Healthy load'}
                color={burdenColor} bg={burdenBg} border={burdenBorder}
                icon={data.burden_pct > 75 ? AlertTriangle : DollarSign} delay={0.12}
              />
            </div>

            {/* ── Health Badge ───────────────────────────────────────────── */}
            <HealthBadge health={data.health} />

            {/* ── Groups ─────────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFD9B0)', border: '1.5px solid #FED7AA' }}>
                  <Package className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Commitment Groups</h3>
                <span className="text-[10px] text-muted-foreground">{activeGroups.length} categories</span>
              </div>
              <div className="space-y-4">
                {activeGroups.map((group, i) => (
                  <GroupCard key={group.id} group={group} index={i} />
                ))}
              </div>
            </div>

            {/* ── Upcoming in 30 days ────────────────────────────────────── */}
            {data.upcoming.length > 0 && <UpcomingSection items={data.upcoming} />}

            {/* ── Monthly Forecast ───────────────────────────────────────── */}
            {data.monthly_forecast.length > 0 && <ForecastChart data={data.monthly_forecast} />}
          </>
        )}

      </div>
    </>
  )
}
