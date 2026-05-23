'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { netWorthApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Camera, Landmark, BarChart3,
  Building2, Wallet, CreditCard, ShieldCheck, Droplets,
  AlertTriangle, Info, Zap, ChevronRight, Activity,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import { toast } from '@/components/ui/Toast'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AllocationSlice { key: string; label: string; value: number; color: string }
interface LiabilityBar    { key: string; label: string; value: number; color: string }
interface HealthPillar     { pillar: string; score: number; max: number; label: string }
interface Insight          { severity: 'CRITICAL' | 'WARNING' | 'INFO'; title: string; body: string; action: string | null }

interface Intelligence {
  net_worth: number;         liquid_net_worth: number
  total_assets: number;      total_liabilities: number
  liquid_assets: number;     liquid_investments: number
  bank_total: number;        bank_liquid: number;     bank_fd: number
  investment_value: number;  total_invested: number;  investment_pnl: number
  asset_value: number;       real_estate_val: number; vehicle_val: number
  loan_outstanding: number;  cc_outstanding: number
  secured_debt: number;      unsecured_debt: number
  monthly_loan_emi: number;  monthly_emi_burden: number
  debt_ratio: number;        cc_utilization: number
  investment_ratio: number;  emergency_months: number
  health_score: number;      health_breakdown: HealthPillar[]
  allocation: AllocationSlice[]
  liabilities_breakdown: LiabilityBar[]
  insights: Insight[]
  change_amount: number;     change_pct: number
}

interface HistoryPoint {
  date: string; net_worth: number; total_assets: number
  total_liabilities: number; bank_balance: number
  investment_value: number; change_amount: number; change_pct: number
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const SEVERITY_CFG = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', iconBg: '#FEE2E2', icon: AlertTriangle, iconColor: '#DC2626', badge: 'badge-danger' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', iconBg: '#FEF3C7', icon: AlertTriangle, iconColor: '#D97706', badge: 'badge-warning' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', iconBg: '#E0F2FE', icon: Info,          iconColor: '#0284C7', badge: 'badge-info'    },
}

const MODULE_NAV: Record<string, ViewId> = {
  banking: 'banking', investments: 'investments', loans: 'loans',
  assets: 'assets', cards: 'cards',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4',
  icon: Icon, onClick, delay = 0, large = false,
}: {
  label: string; value: string; sub?: string; color?: string; bg?: string; border?: string
  icon?: React.ElementType; onClick?: () => void; delay?: number; large?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onClick={onClick}
      className={cn('rounded-2xl p-4 flex flex-col gap-1 transition-all', onClick && 'cursor-pointer hover:scale-[1.02]')}
      style={{ background: bg, border: `1.5px solid ${border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-50" style={{ color }} />}
      </div>
      <span className={cn('font-extrabold font-mono leading-none', large ? 'text-3xl' : 'text-xl')}
        style={{ color, letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </motion.div>
  )
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'
  const label = score >= 75 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work'
  const r = 44, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ * 0.75   // 3/4 arc
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={120} height={90} viewBox="0 0 120 90">
        {/* Track */}
        <path d="M 16 80 A 44 44 0 1 1 104 80" fill="none" stroke="#F0EAE4" strokeWidth={10} strokeLinecap="round" />
        {/* Fill */}
        <path d="M 16 80 A 44 44 0 1 1 104 80" fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="60" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}
          fontFamily="var(--font-mono)" letterSpacing="-1">{score}</text>
        <text x="60" y="82" textAnchor="middle" fontSize="10" fill="#A09890">{label}</text>
      </svg>
    </div>
  )
}

function AllocationDonut({ data }: { data: AllocationSlice[] }) {
  if (!data.length) return <EmptyChart label="No assets recorded" />
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%"
          innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Pie>
        <Tooltip
          formatter={(v: number, name: string) => [
            `${formatCurrencyCompact(v)} (${((v / total) * 100).toFixed(1)}%)`, name
          ]}
          contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function TimelineChart({ data }: { data: HistoryPoint[] }) {
  if (!data.length) return <EmptyChart label="Take a snapshot to start tracking" />

  // Single snapshot — show a summary card instead of broken dots
  if (data.length === 1) {
    const p = data[0]
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-4">
        <div className="flex gap-6 text-center">
          {[
            { label: 'Assets', value: p.total_assets, color: '#10B981' },
            { label: 'Liabilities', value: p.total_liabilities, color: '#F97316' },
            { label: 'Net Worth', value: p.net_worth, color: '#7C3AED' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="text-sm font-bold" style={{ color }}>{formatCurrencyCompact(value)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[260px] leading-relaxed">
          Snapshot taken on <span className="font-medium text-foreground">{format(parseISO(data[0].date), 'dd MMM yyyy')}</span>.
          Take monthly snapshots to build your wealth timeline.
        </p>
      </div>
    )
  }

  const fmt = data.map(d => ({ ...d, label: format(parseISO(d.date), 'MMM yy') }))
  const showDots = data.length <= 4
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={fmt} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F97316" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="nGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE4" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          formatter={(v: number, name: string) => [
            formatCurrencyCompact(v),
            name === 'total_assets' ? 'Assets' : name === 'total_liabilities' ? 'Liabilities' : 'Net Worth'
          ]}
          contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="total_assets"      stroke="#10B981" fill="url(#aGrad)" strokeWidth={1.5} dot={showDots ? { r: 3, fill: '#10B981', strokeWidth: 0 } : false} />
        <Area type="monotone" dataKey="total_liabilities" stroke="#F97316" fill="url(#lGrad)" strokeWidth={1.5} dot={showDots ? { r: 3, fill: '#F97316', strokeWidth: 0 } : false} />
        <Area type="monotone" dataKey="net_worth"         stroke="#7C3AED" fill="url(#nGrad)" strokeWidth={2.5} dot={showDots ? { r: 4, fill: '#7C3AED', strokeWidth: 0 } : false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function LiabilityWaterfall({ data }: { data: LiabilityBar[] }) {
  if (!data.length) return <EmptyChart label="No liabilities" />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" tickFormatter={v => formatCurrencyCompact(v)}
          tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#6B6460' }} axisLine={false} tickLine={false} width={100} />
        <Tooltip formatter={(v: number) => [formatCurrencyCompact(v), 'Outstanding']}
          contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function LiquidityBars({ d }: { d: Intelligence }) {
  const bars = [
    { label: 'Cash & Banking', value: d.bank_liquid,          color: '#0EA5E9' },
    { label: 'Fixed Deposits', value: d.bank_fd,              color: '#38BDF8' },
    { label: 'Liquid Invests', value: d.liquid_investments,   color: '#7C3AED' },
    { label: 'Illiquid Assets', value: d.asset_value,         color: '#10B981' },
  ].filter(b => b.value > 0)
  if (!bars.length) return <EmptyChart label="Add banking & investment data" />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={bars} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip formatter={(v: number) => [formatCurrencyCompact(v)]}
          contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {bars.map(b => <Cell key={b.label} fill={b.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">{label}</div>
  )
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Allocation legend row ────────────────────────────────────────────────────
function AllocRow({ item, total }: { item: AllocationSlice; total: number }) {
  const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0'
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
      <span className="text-xs text-foreground flex-1 truncate">{item.label}</span>
      <span className="text-xs font-mono font-semibold text-foreground">{formatCurrencyCompact(item.value)}</span>
      <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function NetWorthView() {
  const qc = useQueryClient()
  const setView = useUIStore(s => s.setView)

  const { data: d, isLoading } = useQuery<Intelligence>({
    queryKey: ['net-worth-intelligence'],
    queryFn: async () => (await netWorthApi.intelligence()).data,
  })

  const { data: history = [] } = useQuery<HistoryPoint[]>({
    queryKey: ['net-worth-history'],
    queryFn: async () => (await netWorthApi.history(12)).data,
  })

  const snapshot = useMutation({
    mutationFn: () => netWorthApi.snapshot(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['net-worth-intelligence'] })
      qc.invalidateQueries({ queryKey: ['net-worth-history'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      const score = res.data?.health_score
      toast.success('Snapshot saved', score != null ? `Health score: ${score}/100` : undefined)
    },
    onError: () => toast.error('Snapshot failed'),
  })

  const nw            = d?.net_worth ?? 0
  const isPositive    = nw >= 0
  const healthScore   = d?.health_score ?? 0
  const healthColor   = healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#EF4444'
  const allocationTotal = (d?.allocation ?? []).reduce((s, a) => s + a.value, 0)

  return (
    <>
      <PageHeader
        icon={Activity}
        title="Net Worth"
        subtitle="Wealth Intelligence Engine"
        actions={
          <button onClick={() => snapshot.mutate()} disabled={snapshot.isPending} className="btn-primary">
            <Camera className="w-4 h-4" />
            {snapshot.isPending ? 'Saving…' : 'Snapshot'}
          </button>
        }
      />

      <div className="p-3 sm:p-5 xl:p-6 max-w-[1280px] mx-auto space-y-5">

        {/* ── Hero Banner ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #1A0F0A 100%)' }}
        >
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #F97316, transparent)', transform: 'translate(30%, -30%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Net Worth + Health Score */}
            <div className="flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Total Net Worth
              </p>
              <p className="font-extrabold font-mono leading-none" style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                color: isPositive ? '#A7F3D0' : '#FCA5A5',
                letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1'
              }}>
                {isLoading ? '—' : formatCurrency(nw)}
              </p>
              {d && (
                <div className={cn('flex items-center gap-1.5 mt-2 text-sm font-semibold',
                  d.change_amount >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {d.change_amount >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {d.change_amount >= 0 ? '+' : ''}{formatCurrencyCompact(d.change_amount)}
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                    ({Math.abs(d.change_pct).toFixed(1)}% vs last snapshot)
                  </span>
                </div>
              )}

              {/* Asset / Liability pills */}
              <div className="flex gap-3 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">Assets {isLoading ? '—' : formatCurrencyCompact(d?.total_assets ?? 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                  <TrendingDown className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-bold text-orange-300">Liabilities {isLoading ? '—' : formatCurrencyCompact(d?.total_liabilities ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Health Score Gauge */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Health Score</p>
              <HealthGauge score={healthScore} />
              {d?.health_breakdown && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {d.health_breakdown.map(p => (
                    <div key={p.pillar} className="text-center">
                      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.pillar}</div>
                      <div className="text-xs font-bold font-mono" style={{ color: healthColor }}>{p.score}/{p.max}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── 6 Metric Tiles ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile label="Liquid NW" value={formatCurrencyCompact(d?.liquid_net_worth ?? 0)}
            sub="Cash − short-term debt" color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
            icon={Droplets} delay={0} />
          <MetricTile label="Liquid Assets" value={formatCurrencyCompact(d?.liquid_assets ?? 0)}
            sub="Bank + liquid invests" color="#0284C7" bg="#F0F9FF" border="#BAE6FD"
            icon={Landmark} onClick={() => setView('banking')} delay={0.04} />
          <MetricTile label="Investments" value={formatCurrencyCompact(d?.investment_value ?? 0)}
            sub={d ? `${d.investment_ratio.toFixed(0)}% of assets` : ''}
            color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
            icon={BarChart3} onClick={() => setView('investments')} delay={0.08} />
          <MetricTile label="Debt Ratio" value={`${(d?.debt_ratio ?? 0).toFixed(1)}%`}
            sub={d ? (d.debt_ratio < 30 ? 'Healthy' : d.debt_ratio < 50 ? 'Elevated' : 'High') : ''}
            color={d ? (d.debt_ratio < 30 ? '#10B981' : d.debt_ratio < 50 ? '#F59E0B' : '#EF4444') : '#6B7280'}
            bg={d ? (d.debt_ratio < 30 ? '#F0FDF4' : d.debt_ratio < 50 ? '#FFFBEB' : '#FEF2F2') : '#F5F5F5'}
            border={d ? (d.debt_ratio < 30 ? '#BBF7D0' : d.debt_ratio < 50 ? '#FDE68A' : '#FECACA') : '#E5E5E5'}
            icon={Wallet} onClick={() => setView('loans')} delay={0.12} />
          <MetricTile label="Emergency Fund" value={`${(d?.emergency_months ?? 0).toFixed(1)}mo`}
            sub="Months of burn covered"
            color={d ? (d.emergency_months >= 6 ? '#10B981' : d.emergency_months >= 3 ? '#F59E0B' : '#EF4444') : '#6B7280'}
            bg={d ? (d.emergency_months >= 6 ? '#F0FDF4' : d.emergency_months >= 3 ? '#FFFBEB' : '#FEF2F2') : '#F5F5F5'}
            border={d ? (d.emergency_months >= 6 ? '#BBF7D0' : d.emergency_months >= 3 ? '#FDE68A' : '#FECACA') : '#E5E5E5'}
            icon={ShieldCheck} delay={0.16} />
          <MetricTile label="CC Utilization" value={`${(d?.cc_utilization ?? 0).toFixed(0)}%`}
            sub={d ? (d.cc_utilization < 30 ? 'Great' : d.cc_utilization < 60 ? 'Moderate' : 'High') : ''}
            color={d ? (d.cc_utilization < 30 ? '#10B981' : d.cc_utilization < 60 ? '#F59E0B' : '#EF4444') : '#6B7280'}
            bg={d ? (d.cc_utilization < 30 ? '#F0FDF4' : d.cc_utilization < 60 ? '#FFFBEB' : '#FEF2F2') : '#F5F5F5'}
            border={d ? (d.cc_utilization < 30 ? '#BBF7D0' : d.cc_utilization < 60 ? '#FDE68A' : '#FECACA') : '#E5E5E5'}
            icon={CreditCard} onClick={() => setView('cards')} delay={0.2} />
        </div>

        {/* ── Charts row 1: Timeline + Allocation ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <ChartCard title="Net Worth Timeline" subtitle="Assets · Liabilities · Net Worth over time">
            <TimelineChart data={history} />
            <div className="flex items-center gap-4 mt-3 justify-center">
              {[{ c: '#10B981', l: 'Assets' }, { c: '#F97316', l: 'Liabilities' }, { c: '#7C3AED', l: 'Net Worth' }].map(({ c, l }) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-[11px] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Asset Allocation" subtitle="Distribution across all asset classes">
            <AllocationDonut data={d?.allocation ?? []} />
            <div className="divide-y divide-border/40 mt-1">
              {(d?.allocation ?? []).slice(0, 6).map(item => (
                <AllocRow key={item.key} item={item} total={allocationTotal} />
              ))}
            </div>
          </ChartCard>
        </div>

        {/* ── Charts row 2: Liability waterfall + Liquidity bar ───────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Liability Waterfall" subtitle="Breakdown of all outstanding debt">
            <LiabilityWaterfall data={d?.liabilities_breakdown ?? []} />
            {d && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Secured vs Unsecured</span>
                <div className="flex gap-3 text-xs font-semibold">
                  <span className="text-emerald-600">Secured {formatCurrencyCompact(d.secured_debt)}</span>
                  <span className="text-rose-600">Unsecured {formatCurrencyCompact(d.unsecured_debt)}</span>
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Liquidity Spectrum" subtitle="How quickly can you access each asset?">
            <LiquidityBars d={d ?? {} as Intelligence} />
            {d && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded-lg bg-[#F0FDF4]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Liquid</div>
                  <div className="text-sm font-bold font-mono text-emerald-700">{formatCurrencyCompact(d.liquid_assets)}</div>
                  <div className="text-[10px] text-muted-foreground">&lt; 3 days</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#EFF6FF]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Semi</div>
                  <div className="text-sm font-bold font-mono text-blue-700">{formatCurrencyCompact(d.bank_fd)}</div>
                  <div className="text-[10px] text-muted-foreground">FD / Bonds</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#FFF7ED]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Illiquid</div>
                  <div className="text-sm font-bold font-mono text-orange-700">{formatCurrencyCompact(d.asset_value)}</div>
                  <div className="text-[10px] text-muted-foreground">Real estate / etc</div>
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── AI Insights ─────────────────────────────────────────────────── */}
        {d?.insights && d.insights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFD9B0)', border: '1.5px solid #FED7AA' }}>
                <Zap className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Wealth Intelligence</h3>
              <span className="badge-neutral text-[10px]">{d.insights.length} insights</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {d.insights.map((ins, i) => {
                const cfg = SEVERITY_CFG[ins.severity]
                const Icon = cfg.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.06 }}
                    className={cn('rounded-2xl p-4', ins.action && 'cursor-pointer hover:scale-[1.01] transition-transform')}
                    style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
                    onClick={() => ins.action && setView(MODULE_NAV[ins.action] ?? 'dashboard')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.iconBg }}>
                        <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-sm font-bold text-foreground leading-snug">{ins.title}</p>
                          {ins.action && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ins.body}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Quick Nav ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3">Manage Your Wealth</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { view: 'banking'     as const, label: 'Banking',     icon: Landmark,  color: '#0EA5E9', bg: '#F0F9FF', val: d?.bank_total },
              { view: 'investments' as const, label: 'Investments', icon: BarChart3,  color: '#7C3AED', bg: '#F5F3FF', val: d?.investment_value },
              { view: 'loans'       as const, label: 'Loans',       icon: Wallet,    color: '#DC2626', bg: '#FEF2F2', val: d?.loan_outstanding },
              { view: 'assets'      as const, label: 'Assets',      icon: Building2, color: '#10B981', bg: '#F0FDF4', val: d?.asset_value },
              { view: 'cards'       as const, label: 'Cards',       icon: CreditCard,color: '#F97316', bg: '#FFF7ED', val: d?.cc_outstanding },
            ].map(({ view, label, icon: Icon, color, bg, val }) => (
              <button key={view} onClick={() => setView(view)}
                className="card p-4 flex flex-col items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: bg, border: `1.5px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-xs font-bold text-foreground">{label}</span>
                {val != null && (
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                    {formatCurrencyCompact(val)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

      </div>
    </>
  )
}
