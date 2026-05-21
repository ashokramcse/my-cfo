'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { investmentsApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Wallet, Lock, RefreshCw,
  AlertTriangle, Info, Zap, ChevronRight, BarChart3,
  Layers, Star, LineChart,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type {
  InvestmentIntelligence, InvAllocationSlice, InvHolding,
  InvPerformer, InvInsight,
} from '@/types'

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', icon: Info,          iconBg: '#E0F2FE', iconColor: '#0284C7' },
}

// ─── Diversification gauge ────────────────────────────────────────────────────
function DivScore({ score }: { score: number }) {
  const R = 44, CX = 56, CY = 56
  const startAngle = -210 * (Math.PI / 180)
  const totalAngle = 240 * (Math.PI / 180)
  const filledAngle = (score / 100) * totalAngle

  const arc = (start: number, sweep: number) => {
    const x1 = CX + R * Math.cos(start), y1 = CY + R * Math.sin(start)
    const x2 = CX + R * Math.cos(start + sweep), y2 = CY + R * Math.sin(start + sweep)
    return `M ${x1} ${y1} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`
  }

  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'
  const label = score >= 70 ? 'Great' : score >= 40 ? 'Fair' : 'Poor'

  return (
    <div className="flex flex-col items-center">
      <svg width={112} height={90} viewBox="0 0 112 90">
        <path d={arc(startAngle, totalAngle)} fill="none" stroke="#F3E8D6" strokeWidth={8} strokeLinecap="round" />
        {score > 0 && <path d={arc(startAngle, filledAngle)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={20} fontWeight="700" fill={color}>{score}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={10} fill="#92694A">{label}</text>
      </svg>
      <span className="text-xs text-amber-700 -mt-1">Diversification</span>
    </div>
  )
}

// ─── Metric tile ──────────────────────────────────────────────────────────────
function MetricTile({
  label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4',
  icon: Icon, delay = 0,
}: {
  label: string; value: string; sub?: string; color?: string; bg?: string; border?: string
  icon: React.ElementType; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-xl p-4 border flex flex-col gap-1"
      style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-medium text-amber-700">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-amber-600">{sub}</p>}
    </motion.div>
  )
}

// ─── Allocation row ───────────────────────────────────────────────────────────
function AllocRow({ s }: { s: InvAllocationSlice }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
      <span className="text-sm text-amber-900 flex-1 truncate">{s.label}</span>
      <span className="text-xs font-semibold text-amber-700">{s.pct}%</span>
      <span className="text-xs text-amber-600 w-20 text-right">{formatCurrencyCompact(s.value)}</span>
    </div>
  )
}

// ─── Holding row ──────────────────────────────────────────────────────────────
function HoldingRow({ h, rank }: { h: InvHolding; rank: number }) {
  const pos = h.pnl >= 0
  return (
    <div className="flex items-center gap-3 py-3 border-b border-amber-100 last:border-0">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: h.color }}>{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-amber-900 truncate">{h.name}</p>
          {h.is_locked && <Lock size={11} className="text-amber-500 flex-shrink-0" />}
          {h.is_sip && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">SIP</span>}
        </div>
        <p className="text-xs text-amber-600">{h.label}{h.broker ? ` · ${h.broker}` : ''}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(h.current)}</p>
        <p className={cn('text-xs font-medium', pos ? 'text-emerald-600' : 'text-red-500')}>
          {pos ? '+' : ''}{h.pnl_pct}%
        </p>
      </div>
      <span className="text-xs text-amber-400 w-10 text-right">{h.pct}%</span>
    </div>
  )
}

// ─── Performer card ───────────────────────────────────────────────────────────
function PerformerCard({ p, gain }: { p: InvPerformer; gain: boolean }) {
  return (
    <div className={cn('rounded-lg p-3 border', gain
      ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
      <div className="flex items-center gap-2 mb-1">
        {gain ? <TrendingUp size={13} className="text-emerald-600" /> : <TrendingDown size={13} className="text-red-500" />}
        <span className="text-xs text-gray-500">{p.type}</span>
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
      <p className={cn('text-sm font-bold mt-0.5', gain ? 'text-emerald-600' : 'text-red-500')}>
        {gain ? '+' : ''}{p.pnl_pct}%
      </p>
    </div>
  )
}

const EMPTY: InvestmentIntelligence = {
  total_invested: 0, total_value: 0, total_pnl: 0, pnl_pct: 0, realized_pnl: 0,
  sip_monthly: 0, sip_count: 0, locked_value: 0, diversification_score: 0,
  allocation: [], by_type: [], top_holdings: [], best_performers: [], worst_performers: [], insights: [],
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function InvestmentsView() {
  const setView = useUIStore(s => s.setView)

  const { data: intel = EMPTY } = useQuery<InvestmentIntelligence>({
    queryKey: ['investment-intelligence'],
    queryFn: () => investmentsApi.intelligence().then(r => r.data),
  })

  const pos = intel.total_pnl >= 0

  const NAV: Record<string, ViewId> = {
    'net-worth': 'net-worth', banking: 'banking', loans: 'loans',
    assets: 'assets', cards: 'cards', investments: 'investments',
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader icon={LineChart} title="Investment Intelligence" subtitle="Multi-asset portfolio analytics" />

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #1A1A2E 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full opacity-10"
               style={{ background: '#F59E0B', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full opacity-10"
               style={{ background: '#8B5CF6', filter: 'blur(60px)' }} />
        </div>
        <div className="relative p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="flex-1">
            <p className="text-amber-400 text-sm font-medium mb-1">Portfolio Value</p>
            <p className="text-4xl font-black text-white">{formatCurrencyCompact(intel.total_value)}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-amber-300 text-sm">Invested: {formatCurrencyCompact(intel.total_invested)}</span>
              <span className={cn('flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full',
                pos ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300')}>
                {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {pos ? '+' : ''}{formatCurrencyCompact(intel.total_pnl)} ({pos ? '+' : ''}{intel.pnl_pct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-amber-500 flex-wrap">
              <span>SIP: {formatCurrency(intel.sip_monthly)}/mo</span>
              <span>Locked: {formatCurrencyCompact(intel.locked_value)}</span>
              <span>Realised: {formatCurrencyCompact(intel.realized_pnl)}</span>
            </div>
          </div>
          <div className="flex-shrink-0"><DivScore score={intel.diversification_score} /></div>
        </div>
      </motion.div>

      {/* ── Metric tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile delay={0.05} label="Total Invested" value={formatCurrencyCompact(intel.total_invested)} icon={Wallet} />
        <MetricTile delay={0.10} label="Unrealised P&L"
          value={formatCurrencyCompact(intel.total_pnl)}
          sub={`${intel.pnl_pct > 0 ? '+' : ''}${intel.pnl_pct.toFixed(1)}%`}
          icon={pos ? TrendingUp : TrendingDown}
          bg={pos ? '#F0FDF4' : '#FEF2F2'} border={pos ? '#BBF7D0' : '#FECACA'}
          color={pos ? '#166534' : '#991B1B'} />
        <MetricTile delay={0.15} label="Active SIPs" value={`${intel.sip_count} SIPs`}
          sub={`${formatCurrency(intel.sip_monthly)}/mo`} icon={RefreshCw}
          bg="#F5F3FF" border="#DDD6FE" color="#5B21B6" />
        <MetricTile delay={0.20} label="Locked" value={formatCurrencyCompact(intel.locked_value)}
          icon={Lock} bg="#FFFBEB" border="#FDE68A" color="#92400E" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Allocation donut */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-600">◉</span>
            <h3 className="text-sm font-semibold text-amber-900">Asset Class Allocation</h3>
          </div>
          {intel.allocation.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={intel.allocation} dataKey="value" cx="50%" cy="50%"
                       innerRadius={38} outerRadius={62} paddingAngle={2}>
                    {intel.allocation.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {intel.allocation.map((s, i) => <AllocRow key={i} s={s} />)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">Add investments to see allocation</p>
          )}
        </div>

        {/* By type horizontal bars */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">By Investment Type</h3>
          </div>
          {intel.by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={intel.by_type} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                <Bar dataKey="current" name="Value" radius={[0, 4, 4, 0]}>
                  {intel.by_type.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      {/* ── Top Holdings ── */}
      {intel.top_holdings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Top Holdings</h3>
          </div>
          {intel.top_holdings.map((h, i) => <HoldingRow key={h.id} h={h} rank={i + 1} />)}
        </motion.div>
      )}

      {/* ── Performers ── */}
      {(intel.best_performers.length > 0 || intel.worst_performers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {intel.best_performers.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star size={15} className="text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-800">Top Performers</h3>
              </div>
              <div className="space-y-2">
                {intel.best_performers.map((p, i) => <PerformerCard key={i} p={p} gain />)}
              </div>
            </div>
          )}
          {intel.worst_performers.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={15} className="text-red-500" />
                <h3 className="text-sm font-semibold text-red-800">Underperformers</h3>
              </div>
              <div className="space-y-2">
                {intel.worst_performers.map((p, i) => <PerformerCard key={i} p={p} gain={false} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI Insights ── */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Portfolio Intelligence</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {intel.insights.map((ins, i) => {
              const cfg = SEV[ins.severity]
              const Icon = cfg.icon
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="rounded-xl p-4 border cursor-pointer hover:brightness-95 transition-all"
                  style={{ background: cfg.bg, borderColor: cfg.border }}
                  onClick={() => ins.action && NAV[ins.action] && setView(NAV[ins.action])}>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.iconBg }}>
                      <Icon size={14} style={{ color: cfg.iconColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{ins.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ins.body}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Net Worth link ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex items-center justify-between cursor-pointer hover:brightness-95 transition-all"
        onClick={() => setView('net-worth')}>
        <div>
          <p className="text-sm font-semibold text-amber-900">View in Net Worth Engine</p>
          <p className="text-xs text-amber-600 mt-0.5">See how investments contribute to your total wealth</p>
        </div>
        <ChevronRight size={18} className="text-amber-500" />
      </motion.div>
    </div>
  )
}
