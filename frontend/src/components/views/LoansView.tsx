'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { loansApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, Info, Zap, ChevronRight, TrendingDown,
  Shield, ShieldOff, Clock, BarChart3, Percent, Landmark,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, Legend,
} from 'recharts'
import type {
  LoanIntelligence, LoanTypeBreakdown, LoanCard,
  AmortizationMonth, LoanInsight,
} from '@/types'

const SEV = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', icon: Info,          iconBg: '#E0F2FE', iconColor: '#0284C7' },
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

// ─── Loan Card ────────────────────────────────────────────────────────────────
function LoanCardItem({ loan }: { loan: LoanCard }) {
  const paidPct = Math.min(loan.paid_pct, 100)
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ background: loan.color }} />
          <div>
            <p className="text-sm font-semibold text-amber-900">{loan.name}</p>
            <p className="text-xs text-amber-600">{loan.lender} · {loan.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {loan.is_secured
            ? <Shield size={13} className="text-emerald-500" />
            : <ShieldOff size={13} className="text-amber-400" />}
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
            loan.status === 'ACTIVE'   ? 'bg-emerald-100 text-emerald-700' :
            loan.status === 'OVERDUE'  ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600')}>
            {loan.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-amber-600 mb-1">
          <span>Paid: {formatCurrencyCompact(loan.paid)} ({paidPct.toFixed(0)}%)</span>
          <span>Outstanding: {formatCurrencyCompact(loan.outstanding)}</span>
        </div>
        <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${paidPct}%`, background: loan.color }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-amber-500">EMI</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(loan.emi)}</p>
        </div>
        <div>
          <p className="text-xs text-amber-500">Rate</p>
          <p className="text-sm font-bold text-amber-900">{loan.interest_rate}%</p>
        </div>
        <div>
          <p className="text-xs text-amber-500">Left</p>
          <p className="text-sm font-bold text-amber-900">
            {loan.remaining_months != null ? `${loan.remaining_months}mo` : '—'}
          </p>
        </div>
      </div>

      {loan.emi_due_day > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
          <Clock size={11} />
          <span>Due on day {loan.emi_due_day} of each month</span>
        </div>
      )}
    </div>
  )
}

const EMPTY: LoanIntelligence = {
  total_outstanding: 0, total_monthly_emi: 0, total_principal: 0,
  total_paid: 0, total_interest_paid: 0, weighted_avg_rate: 0,
  secured_total: 0, unsecured_total: 0, active_count: 0,
  by_type: [], loan_cards: [], amortization: [], high_interest: [], insights: [],
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LoansView() {
  const setView = useUIStore(s => s.setView)

  const { data: intel = EMPTY } = useQuery<LoanIntelligence>({
    queryKey: ['loan-intelligence'],
    queryFn: () => loansApi.intelligence().then(r => r.data),
  })

  const NAV: Record<string, ViewId> = {
    'net-worth': 'net-worth', banking: 'banking', investments: 'investments',
    assets: 'assets', cards: 'cards', loans: 'loans',
  }

  const paidPct = intel.total_principal > 0
    ? Math.min(intel.total_paid / intel.total_principal * 100, 100) : 0

  return (
    <div className="space-y-6 pb-10 p-3 sm:p-5 xl:p-6 max-w-[1440px] mx-auto">
      <PageHeader icon={Landmark} title="Debt Intelligence" subtitle="Debt command center & repayment planner" />

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #1F1F2E 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full opacity-10"
               style={{ background: '#EF4444', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-10"
               style={{ background: '#F59E0B', filter: 'blur(60px)' }} />
        </div>
        <div className="relative p-6">
          <p className="text-red-400 text-sm font-medium mb-1">Total Outstanding</p>
          <p className="text-4xl font-black text-white">{formatCurrencyCompact(intel.total_outstanding)}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-sm">
            <span className="text-amber-300">{intel.active_count} active loans</span>
            <span className="text-red-300">EMI: {formatCurrency(intel.total_monthly_emi)}/mo</span>
            <span className="text-amber-400">Avg rate: {intel.weighted_avg_rate.toFixed(1)}%</span>
          </div>

          {/* Overall repayment progress */}
          {intel.total_principal > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-amber-400 mb-1">
                <span>Repayment progress</span>
                <span>{paidPct.toFixed(0)}% paid ({formatCurrencyCompact(intel.total_paid)} of {formatCurrencyCompact(intel.total_principal)})</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }} animate={{ width: `${paidPct}%` }}
                  transition={{ duration: 1, delay: 0.5 }} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Metric tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile delay={0.05} label="Monthly EMI" value={formatCurrency(intel.total_monthly_emi)} icon={Clock} />
        <MetricTile delay={0.10} label="Avg Interest Rate"
          value={`${intel.weighted_avg_rate.toFixed(1)}%`}
          icon={Percent} bg="#FEF2F2" border="#FECACA" color="#991B1B" />
        <MetricTile delay={0.15} label="Secured Debt"
          value={formatCurrencyCompact(intel.secured_total)}
          icon={Shield} bg="#F0FDF4" border="#BBF7D0" color="#166534" />
        <MetricTile delay={0.20} label="Unsecured Debt"
          value={formatCurrencyCompact(intel.unsecured_total)}
          icon={ShieldOff} bg="#FFFBEB" border="#FDE68A" color="#92400E" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Debt waterfall by type */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Debt by Category</h3>
          </div>
          {intel.by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={intel.by_type} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                <Bar dataKey="outstanding" name="Outstanding" radius={[0, 4, 4, 0]}>
                  {intel.by_type.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">No active loans</p>
          )}
        </div>

        {/* Amortization — 12 month interest vs principal */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Amortization (12 months)</h3>
          </div>
          {intel.amortization.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={intel.amortization} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D6" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="principal" name="Principal" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="interest"  name="Interest"  stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">No EMI data available</p>
          )}
        </div>
      </div>

      {/* ── High interest alert ── */}
      {intel.high_interest.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-500" />
            <h3 className="text-sm font-semibold text-red-800">High-Interest Loans (≥12%)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {intel.high_interest.map((h, i) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-red-200">
                <p className="text-sm font-semibold text-gray-800 truncate">{h.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{formatCurrencyCompact(h.outstanding)}</span>
                  <span className="text-sm font-bold text-red-600">{h.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loan cards ── */}
      {intel.loan_cards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-900 mb-3">Active Loans</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intel.loan_cards.map(loan => <LoanCardItem key={loan.id} loan={loan} />)}
          </div>
        </div>
      )}

      {/* ── AI Insights ── */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Debt Intelligence</h3>
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
                  onClick={() => ins.action && NAV[ins.action] && setView(NAV[ins.action] as ViewId)}>
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
        className="rounded-xl border border-amber-200 bg-gradient-to-r from-red-50 to-orange-50 p-4 flex items-center justify-between cursor-pointer hover:brightness-95 transition-all"
        onClick={() => setView('net-worth')}>
        <div>
          <p className="text-sm font-semibold text-amber-900">View in Net Worth Engine</p>
          <p className="text-xs text-amber-600 mt-0.5">See how debt affects your overall financial health</p>
        </div>
        <ChevronRight size={18} className="text-amber-500" />
      </motion.div>
    </div>
  )
}
