'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { incomeApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  TrendingUp, Plus, X, AlertTriangle, Info, Zap,
  ChevronRight, Briefcase, DollarSign, BarChart3,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import { toast } from '@/components/ui/Toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie,
} from 'recharts'
import type { IncomeIntelligence, IncomeSourceCard, IncomeTypeBreakdown } from '@/types'

const SEV = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', icon: Info,          iconBg: '#E0F2FE', iconColor: '#0284C7' },
}

const INCOME_TYPES = [
  'SALARY','FREELANCE','BUSINESS','CONSULTING','RENTAL',
  'INTEREST','DIVIDEND','SIDE_HUSTLE','PENSION','REMITTANCE','OTHER',
]
const TYPE_LABELS: Record<string,string> = {
  SALARY:'Salary', FREELANCE:'Freelancing', BUSINESS:'Business',
  CONSULTING:'Consulting', RENTAL:'Rental', INTEREST:'Interest',
  DIVIDEND:'Dividends', SIDE_HUSTLE:'Side Hustle',
  PENSION:'Pension', REMITTANCE:'Remittance', OTHER:'Other',
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────
function AddSourceModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    name: '', income_type: 'SALARY', employer: '',
    monthly_amount: '', is_variable: false,
    variable_min: '', variable_max: '',
    tax_deducted_pct: '0', notes: '',
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(24,18,14,0.6)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-amber-100">
          <h2 className="font-bold text-amber-900">Add Income Source</h2>
          <button onClick={onClose} className="text-amber-400 hover:text-amber-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Source Name *</label>
            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Infosys Salary, Flat 3B Rent"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Type *</label>
            <select className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              value={form.income_type} onChange={e => set('income_type', e.target.value)}>
              {INCOME_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Employer / Client</label>
            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Company or client name"
              value={form.employer} onChange={e => set('employer', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Monthly Amount (₹) *</label>
            <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              placeholder="80000"
              value={form.monthly_amount} onChange={e => set('monthly_amount', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_variable}
              onChange={e => set('is_variable', e.target.checked)} className="rounded" />
            <span className="text-sm text-amber-800">Variable income (ranges)</span>
          </label>
          {form.is_variable && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-amber-700 mb-1 block">Min (₹)</label>
                <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                  value={form.variable_min} onChange={e => set('variable_min', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-amber-700 mb-1 block">Max (₹)</label>
                <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                  value={form.variable_max} onChange={e => set('variable_max', e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">TDS / Tax Deducted (%)</label>
            <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              placeholder="10"
              value={form.tax_deducted_pct} onChange={e => set('tax_deducted_pct', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Notes</label>
            <textarea rows={2} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="p-5 border-t border-amber-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-amber-200 text-sm text-amber-700 hover:bg-amber-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name || !form.monthly_amount) return
              onSave({
                name: form.name, income_type: form.income_type,
                employer: form.employer || undefined,
                monthly_amount: parseFloat(form.monthly_amount),
                is_variable: form.is_variable,
                variable_min: form.variable_min ? parseFloat(form.variable_min) : undefined,
                variable_max: form.variable_max ? parseFloat(form.variable_max) : undefined,
                tax_deducted_pct: parseFloat(form.tax_deducted_pct || '0'),
                notes: form.notes || undefined,
              })
            }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            Add Source
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Metric tile ──────────────────────────────────────────────────────────────
function MetricTile({
  label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4',
  icon: Icon, delay = 0,
}: { label: string; value: string; sub?: string; color?: string; bg?: string; border?: string; icon: React.ElementType; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-xl p-4 border flex flex-col gap-1" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-medium text-amber-700">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-amber-600">{sub}</p>}
    </motion.div>
  )
}

const EMPTY: IncomeIntelligence = {
  total_monthly_gross: 0, total_monthly_net: 0, total_tds: 0,
  annual_gross: 0, annual_net: 0, source_count: 0,
  by_type: [], source_cards: [], monthly_trend: [], insights: [],
}

export function IncomeView() {
  const setView = useUIStore(s => s.setView)
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: intel = EMPTY } = useQuery<IncomeIntelligence>({
    queryKey: ['income-intelligence'],
    queryFn: () => incomeApi.intelligence().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: any) => incomeApi.createSource(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-intelligence'] })
      setShowAdd(false)
      toast.success('Income source added')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => incomeApi.deleteSource(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income-intelligence'] }); toast.success('Removed') },
  })

  const NAV: Record<string, ViewId> = {
    income: 'income', banking: 'banking', 'net-worth': 'net-worth',
    investments: 'investments', goals: 'goals',
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader icon={DollarSign} title="Income Management"
        subtitle="All income sources · tax overview · monthly trends"
        actions={
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            <Plus size={15} /> Add Source
          </button>
        } />

      <AnimatePresence>
        {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onSave={d => createMut.mutate(d)} />}
      </AnimatePresence>

      {/* How-it-works tip */}
      <div className="mx-3 sm:mx-5 xl:mx-6 mt-3 px-4 py-3 rounded-xl flex items-start gap-2.5"
        style={{ background: '#FFF8ED', border: '1.5px solid #FDC888' }}>
        <span className="text-base flex-shrink-0">💡</span>
        <p className="text-xs" style={{ color: '#6B6460' }}>
          <strong style={{ color: '#18120E' }}>How income works:</strong>{' '}
          Add <em>Income Sources</em> (your jobs/clients) — these are your ongoing income streams.
          Monthly entries are auto-generated from active sources and visible in your Income Trend chart.
          Use &quot;Add Source&quot; to set up, then let the system track your earnings automatically.
        </p>
      </div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #0F2D1A 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full opacity-10"
               style={{ background: '#10B981', filter: 'blur(80px)' }} />
        </div>
        <div className="relative p-6">
          <p className="text-emerald-400 text-sm font-medium mb-1">Monthly Gross Income</p>
          <p className="text-4xl font-black text-white">{formatCurrencyCompact(intel.total_monthly_gross)}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-sm">
            <span className="text-emerald-300">Net: {formatCurrencyCompact(intel.total_monthly_net)}</span>
            <span className="text-red-300">TDS: {formatCurrencyCompact(intel.total_tds)}/mo</span>
            <span className="text-amber-400">{intel.source_count} active source(s)</span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-amber-500">
            <span>Annual Gross: {formatCurrencyCompact(intel.annual_gross)}</span>
            <span>Annual Net: {formatCurrencyCompact(intel.annual_net)}</span>
          </div>
        </div>
      </motion.div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile delay={0.05} label="Monthly Net" value={formatCurrencyCompact(intel.total_monthly_net)}
          icon={TrendingUp} bg="#F0FDF4" border="#BBF7D0" color="#166534" />
        <MetricTile delay={0.10} label="Tax Deducted" value={formatCurrencyCompact(intel.total_tds)}
          sub="per month" icon={BarChart3} bg="#FEF2F2" border="#FECACA" color="#991B1B" />
        <MetricTile delay={0.15} label="Annual Gross" value={formatCurrencyCompact(intel.annual_gross)}
          icon={Briefcase} />
        <MetricTile delay={0.20} label="Sources" value={`${intel.source_count} active`}
          icon={DollarSign} bg="#F5F3FF" border="#DDD6FE" color="#5B21B6" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By type donut */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-4">Income Distribution</h3>
          {intel.by_type.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={intel.by_type} dataKey="monthly" cx="50%" cy="50%"
                       innerRadius={35} outerRadius={58} paddingAngle={2}>
                    {intel.by_type.map((t, i) => <Cell key={i} fill={t.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {intel.by_type.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-xs text-amber-900 flex-1 truncate">{t.label}</span>
                    <span className="text-xs font-semibold text-amber-700">{t.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">Add income sources to see distribution</p>
          )}
        </div>

        {/* Monthly trend bars */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-4">Monthly Income Trend</h3>
          {intel.monthly_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={intel.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3E8D6" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatCurrencyCompact(v)} />
                <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">Log income entries to see trends</p>
          )}
        </div>
      </div>

      {/* Source cards */}
      {intel.source_cards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-900 mb-3">Income Sources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intel.source_cards.map(src => (
              <div key={src.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ background: src.color }} />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{src.name}</p>
                      <p className="text-xs text-amber-600">{src.label}{src.employer ? ` · ${src.employer}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteMut.mutate(src.id)}
                    className="text-amber-300 hover:text-red-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-amber-500">Gross</p>
                    <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(src.monthly)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-500">TDS</p>
                    <p className="text-sm font-bold text-red-600">{src.tds_pct}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-500">Net</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrencyCompact(src.net_monthly)}</p>
                  </div>
                </div>
                {src.is_variable && (
                  <p className="text-xs text-amber-500 mt-2 text-center">
                    Variable: {formatCurrencyCompact(src.variable_min)} – {formatCurrencyCompact(src.variable_max)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Income Intelligence</h3>
          </div>
          <div className="space-y-3">
            {intel.insights.map((ins, i) => {
              const cfg = SEV[ins.severity]; const Icon = cfg.icon
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="rounded-xl border border-amber-200 bg-gradient-to-r from-emerald-50 to-amber-50 p-4 flex items-center justify-between cursor-pointer hover:brightness-95 transition-all"
        onClick={() => setView('net-worth')}>
        <div>
          <p className="text-sm font-semibold text-amber-900">View in Net Worth Engine</p>
          <p className="text-xs text-amber-600 mt-0.5">See how income drives your wealth growth</p>
        </div>
        <ChevronRight size={18} className="text-amber-500" />
      </motion.div>
    </div>
  )
}
