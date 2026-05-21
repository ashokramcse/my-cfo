'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { bankAccountsApi } from '@/lib/api'
import { BankAccount, CashflowIntelligence } from '@/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Landmark, Plus, X, Trash2, Star, Wallet, PiggyBank,
  TrendingUp, TrendingDown, AlertTriangle, Info, Zap,
  ChevronRight, Droplets, Clock, RefreshCw, Edit3,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'
import { useUIStore } from '@/store/ui'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ─── Config ───────────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  { value: 'SAVINGS', label: 'Savings' }, { value: 'CURRENT', label: 'Current' },
  { value: 'SALARY',  label: 'Salary'  }, { value: 'WALLET',  label: 'Wallet'  },
  { value: 'UPI',     label: 'UPI'     }, { value: 'CASH',    label: 'Cash'    },
  { value: 'FD',      label: 'Fixed Deposit' }, { value: 'RD', label: 'Recurring Deposit' },
]

const ACCOUNT_COLORS = ['#0EA5E9','#10B981','#F97316','#7C3AED','#F59E0B','#EC4899','#14B8A6','#6366F1']
const BANKS = ['HDFC','ICICI','SBI','Axis','Kotak','Federal','IDFC','AU','Paytm','PhonePe','GPay','Cash','Other']

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  SAVINGS:  { icon: PiggyBank, label: 'Savings'  },
  CURRENT:  { icon: Landmark,  label: 'Current'  },
  SALARY:   { icon: Wallet,    label: 'Salary'   },
  WALLET:   { icon: Wallet,    label: 'Wallet'   },
  UPI:      { icon: Wallet,    label: 'UPI'      },
  CASH:     { icon: Wallet,    label: 'Cash'     },
  FD:       { icon: Star,      label: 'FD'       },
  RD:       { icon: Star,      label: 'RD'       },
}

const SEVERITY_CFG = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', iconBg: '#FEE2E2', icon: AlertTriangle, iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', iconBg: '#FEF3C7', icon: AlertTriangle, iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', iconBg: '#E0F2FE', icon: Info,          iconColor: '#0284C7' },
}

const CAT_COLORS = ['#F97316','#7C3AED','#0EA5E9','#10B981','#F59E0B','#EC4899','#14B8A6','#6366F1']

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({ label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4', icon: Icon, onClick, delay = 0 }: {
  label: string; value: string; sub?: string; color?: string; bg?: string; border?: string
  icon?: React.ElementType; onClick?: () => void; delay?: number
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
      <span className="text-xl font-extrabold font-mono leading-none" style={{ color, letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </motion.div>
  )
}

function ChartCard({ title, subtitle, children, className }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
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

function EmptyState({ label }: { label: string }) {
  return <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">{label}</div>
}

function AccountCard({ acc, onClick }: { acc: BankAccount; onClick: () => void }) {
  const { icon: Icon } = TYPE_META[acc.account_type] ?? TYPE_META.SAVINGS
  const bal = Number(acc.current_balance)
  const minBal = Number(acc.minimum_balance)
  const belowMin = minBal > 0 && bal < minBal
  return (
    <motion.div
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'rounded-2xl p-5 cursor-pointer border-[1.5px] transition-all relative overflow-hidden',
        belowMin ? 'border-amber-300' : 'border-border hover:border-orange-200'
      )}
      style={{ background: belowMin ? '#FFFBEB' : '#FFFFFF' }}
    >
      {/* Subtle brand strip */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: acc.account_color }} />

      <div className="flex items-start justify-between mb-4 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${acc.account_color}18`, border: `1.5px solid ${acc.account_color}40` }}>
            <Icon className="w-5 h-5" style={{ color: acc.account_color }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground">{acc.nickname}</span>
              {acc.is_primary && <Star className="w-3 h-3 text-amber-400" fill="currentColor" />}
            </div>
            <span className="text-xs text-muted-foreground">{acc.bank_name} · {acc.account_type}</span>
          </div>
        </div>
        {belowMin && (
          <span className="badge-warning text-[9px] px-1.5 py-0.5">Below Min</span>
        )}
      </div>

      <div className="text-2xl font-extrabold font-mono text-foreground"
        style={{ letterSpacing: '-0.025em', fontFeatureSettings: '"tnum" 1' }}>
        {formatCurrencyCompact(bal)}
      </div>

      {acc.account_number_last4 && (
        <div className="text-xs text-muted-foreground mt-0.5">···· {acc.account_number_last4}</div>
      )}

      {minBal > 0 && (
        <div className="mt-3">
          <div className="progress-track">
            <div className="progress-fill"
              style={{ width: `${Math.min(100, (bal / minBal) * 100)}%`, background: acc.account_color }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Min: {formatCurrencyCompact(minBal)}</span>
            {Number(acc.interest_rate) > 0 && <span>{acc.interest_rate}% p.a.</span>}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Balance update modal ─────────────────────────────────────────────────────
function BalanceUpdateModal({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const [newBalance, setNewBalance] = useState(String(Number(account.current_balance)))
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const update = useMutation({
    mutationFn: () => bankAccountsApi.updateBalance(account.id, Number(newBalance), notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['banking-cashflow'] })
      qc.invalidateQueries({ queryKey: ['net-worth-intelligence'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      toast.success('Balance updated')
      onClose()
    },
    onError: () => toast.error('Update failed'),
  })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(24,18,14,0.55)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="card p-6 w-full max-w-sm"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">Update Balance — {account.nickname}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
            <X className="w-4 h-4" style={{ color: '#18120E' }} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="field-label">Current Balance (₹)</label>
            <input type="number" step="0.01" value={newBalance}
              onChange={e => setNewBalance(e.target.value)} className="text-lg font-mono font-bold" />
          </div>
          <div>
            <label className="field-label">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. After salary credit" />
          </div>
          <button onClick={() => update.mutate()} disabled={update.isPending}
            className="btn-primary w-full justify-center py-2.5">
            {update.isPending ? 'Updating…' : 'Update Balance'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function BankingView() {
  const [showForm, setShowForm]       = useState(false)
  const [selected, setSelected]       = useState<BankAccount | null>(null)
  const [editBalance, setEditBalance] = useState<BankAccount | null>(null)
  const [cfMonths, setCfMonths]       = useState(3)
  const qc = useQueryClient()
  const setView = useUIStore(s => s.setView)

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => (await bankAccountsApi.list()).data,
  })

  const { data: cf, isLoading: cfLoading } = useQuery<CashflowIntelligence>({
    queryKey: ['banking-cashflow', cfMonths],
    queryFn: async () => (await bankAccountsApi.cashflow(cfMonths)).data,
  })

  const { register, handleSubmit, reset, watch, control } = useForm({
    defaultValues: {
      nickname: '', bank_name: 'HDFC', account_type: 'SAVINGS',
      account_number_last4: '', current_balance: 0, minimum_balance: 0,
      interest_rate: 0, account_color: '#0EA5E9', is_primary: false,
    },
  })

  const createAccount = useMutation({
    mutationFn: (data: unknown) => bankAccountsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['banking-cashflow'] })
      qc.invalidateQueries({ queryKey: ['net-worth-intelligence'] })
      toast.success('Account added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add account'),
  })

  const deleteAccount = useMutation({
    mutationFn: (id: string) => bankAccountsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['banking-cashflow'] })
      qc.invalidateQueries({ queryKey: ['net-worth-intelligence'] })
      setSelected(null)
      toast.success('Account removed')
    },
  })

  const watchColor = watch('account_color')
  const totalBalance   = accounts.reduce((s, a) => s + Number(a.current_balance), 0)
  const primaryAcc     = accounts.find(a => a.is_primary)
  const belowMinCount  = (cf?.account_health ?? []).filter(a => a.below_min).length

  const runwayColor = (cf?.runway_months ?? 0) >= 6 ? '#10B981'
    : (cf?.runway_months ?? 0) >= 3 ? '#F59E0B' : '#EF4444'

  return (
    <>
      <PageHeader
        icon={Landmark}
        title="Banking"
        subtitle="Cash Flow Command Center"
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        }
      />

      <div className="p-3 sm:p-5 xl:p-6 max-w-[1280px] mx-auto space-y-5">

        {/* ── 5 Metric Tiles ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricTile label="Total Balance" value={formatCurrencyCompact(totalBalance)}
            sub={`${accounts.length} accounts`} color="#0EA5E9" bg="#F0F9FF" border="#BAE6FD"
            icon={Landmark} delay={0} />
          <MetricTile label="Liquid Balance" value={formatCurrencyCompact(cf?.liquid_balance ?? 0)}
            sub="Accessible now" color="#10B981" bg="#F0FDF4" border="#BBF7D0"
            icon={Droplets} delay={0.04} />
          <MetricTile label="Avg Monthly In" value={formatCurrencyCompact(cf?.monthly_avg_in ?? 0)}
            sub="Income / credits" color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
            icon={TrendingUp} delay={0.08} />
          <MetricTile label="Avg Monthly Out" value={formatCurrencyCompact(cf?.monthly_avg_out ?? 0)}
            sub="Spend + payments" color={cf && cf.monthly_avg_out > cf.monthly_avg_in ? '#EF4444' : '#F97316'}
            bg={cf && cf.monthly_avg_out > cf.monthly_avg_in ? '#FEF2F2' : '#FFF7ED'}
            border={cf && cf.monthly_avg_out > cf.monthly_avg_in ? '#FECACA' : '#FED7AA'}
            icon={TrendingDown} delay={0.12} />
          <MetricTile label="Cash Runway" value={`${(cf?.runway_months ?? 0).toFixed(1)}mo`}
            sub="At current burn rate" color={runwayColor}
            bg={runwayColor === '#10B981' ? '#F0FDF4' : runwayColor === '#F59E0B' ? '#FFFBEB' : '#FEF2F2'}
            border={runwayColor === '#10B981' ? '#BBF7D0' : runwayColor === '#F59E0B' ? '#FDE68A' : '#FECACA'}
            icon={Clock} delay={0.16} />
        </div>

        {/* ── Accounts Grid ─────────────────────────────────────────────── */}
        {accountsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-[#FFF1E6] shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : accounts.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc, i) => (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <AccountCard acc={acc} onClick={() => setSelected(acc)} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '2px solid #BFDBFE' }}>
              <Landmark className="w-7 h-7 text-blue-500" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">No accounts added yet</p>
              <p className="text-xs mt-1 text-muted-foreground">Track savings, wallets, FDs & cash</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Account
            </button>
          </div>
        )}

        {/* ── Charts Row 1: Cash Flow River + Category ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <ChartCard
            title="Cash Flow River"
            subtitle={
              <div className="flex items-center gap-2">
                <span>Monthly inflow vs outflow</span>
                <div className="flex gap-1 ml-auto">
                  {[3, 6, 12].map(m => (
                    <button key={m} onClick={() => setCfMonths(m)}
                      className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors',
                        cfMonths === m ? 'bg-orange-100 text-orange-600' : 'text-muted-foreground hover:text-foreground')}>
                      {m}M
                    </button>
                  ))}
                </div>
              </div> as unknown as string
            }
          >
            {(cf?.monthly_cashflow ?? []).length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cf?.monthly_cashflow} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: '#A09890' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    formatter={(v: number, n: string) => [formatCurrencyCompact(v), n === 'inflow' ? 'Inflow' : 'Outflow']}
                    contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="inflow"  fill="#10B981" radius={[4,4,0,0]} />
                  <Bar dataKey="outflow" fill="#F97316" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="Add bank transactions to see cash flow" />
            )}
            {cf && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                  <span className="text-muted-foreground">Avg In {formatCurrencyCompact(cf.monthly_avg_in)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#F97316]" />
                  <span className="text-muted-foreground">Avg Out {formatCurrencyCompact(cf.monthly_avg_out)}</span>
                </div>
                <div className={cn('font-semibold', cf.monthly_avg_in > cf.monthly_avg_out ? 'text-emerald-600' : 'text-rose-600')}>
                  Net {formatCurrencyCompact(cf.monthly_avg_in - cf.monthly_avg_out)}/mo
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Category Breakdown" subtitle="Where your money goes">
            {(cf?.category_breakdown ?? []).length ? (
              <>
                <div className="space-y-2">
                  {(cf?.category_breakdown ?? []).slice(0, 6).map((item, i) => {
                    const maxAmt = cf!.category_breakdown[0].amount
                    const pct = maxAmt > 0 ? (item.amount / maxAmt) * 100 : 0
                    return (
                      <div key={item.category} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                        <span className="text-xs text-foreground flex-1 truncate capitalize">
                          {item.category.toLowerCase().replace('_', ' ')}
                        </span>
                        <div className="w-20 progress-track">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                        </div>
                        <span className="text-xs font-mono font-semibold text-foreground w-14 text-right">
                          {formatCurrencyCompact(item.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <EmptyState label="Import transactions to see categories" />
            )}
          </ChartCard>
        </div>

        {/* ── Row 2: Upcoming Payments + Hidden Charges ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Upcoming Payments" subtitle="Next 30 days">
            {(cf?.upcoming_payments ?? []).length ? (
              <div className="space-y-2">
                {cf?.upcoming_payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FFF8F4] border border-border/50">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      p.days_left <= 3 ? 'bg-rose-100' : p.days_left <= 7 ? 'bg-amber-100' : 'bg-blue-50')}>
                      <Clock className={cn('w-4 h-4', p.days_left <= 3 ? 'text-rose-500' : p.days_left <= 7 ? 'text-amber-500' : 'text-blue-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{p.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.days_left === 0 ? 'Due today' : `Due in ${p.days_left}d`}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-foreground">{formatCurrencyCompact(p.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No upcoming payments found" />
            )}
          </ChartCard>

          <ChartCard title="Hidden Charges Detected" subtitle="Bank fees, maintenance, penalties">
            {cf && cf.hidden_count > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-700">
                    {formatCurrencyCompact(cf.hidden_total)} in {cf.hidden_count} hidden charges
                  </span>
                </div>
                <div className="space-y-2">
                  {cf.hidden_charges.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 text-muted-foreground truncate">{t.description}</span>
                      <span className="font-mono font-semibold text-rose-600">−{formatCurrencyCompact(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-6 gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs text-muted-foreground text-center">No hidden charges detected</p>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── AI Insights ───────────────────────────────────────────────── */}
        {cf?.insights && cf.insights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFD9B0)', border: '1.5px solid #FED7AA' }}>
                <Zap className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Cash Flow Intelligence</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cf.insights.map((ins, i) => {
                const cfg = SEVERITY_CFG[ins.severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.INFO
                const Icon = cfg.icon
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.06 }}
                    className="rounded-2xl p-4 cursor-pointer hover:scale-[1.01] transition-transform"
                    style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
                    onClick={() => ins.action && setView('banking')}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.iconBg }}>
                        <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground mb-1">{ins.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ins.body}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Quick link to Net Worth ───────────────────────────────────── */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={() => setView('net-worth')}
          className="w-full card p-4 flex items-center justify-between hover:border-orange-200 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F5F3FF, #DDD6FE)', border: '1.5px solid #C4B5FD' }}>
              <TrendingUp className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">View in Net Worth Engine</p>
              <p className="text-xs text-muted-foreground">Banking contributes {formatCurrencyCompact(cf?.liquid_balance ?? totalBalance)} to your liquid net worth</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </div>

      {/* ── Account Detail Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(24,18,14,0.55)' }} onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="card p-6 w-full max-w-md"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>

              {/* Color strip */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                style={{ background: selected.account_color }} />

              <div className="flex items-center justify-between mb-5 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${selected.account_color}20`, border: `1.5px solid ${selected.account_color}50` }}>
                    <Landmark className="w-5 h-5" style={{ color: selected.account_color }} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-foreground">{selected.nickname}</div>
                    <div className="text-xs text-muted-foreground">{selected.bank_name} · {selected.account_type}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                  <X className="w-4 h-4" style={{ color: '#18120E' }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  ['Balance',        formatCurrency(Number(selected.current_balance))],
                  ['Min Balance',    formatCurrency(Number(selected.minimum_balance))],
                  ['Interest Rate',  `${selected.interest_rate}% p.a.`],
                  ['Account No.',    selected.account_number_last4 ? `···· ${selected.account_number_last4}` : '—'],
                  ['Type',           selected.account_type],
                  ['Status',         selected.is_active ? 'Active' : 'Inactive'],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-semibold text-foreground font-mono">{value}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { setSelected(null); setEditBalance(selected) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                  <Edit3 className="w-4 h-4" /> Update Balance
                </button>
              </div>
              <button onClick={() => deleteAccount.mutate(selected.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors">
                <Trash2 className="w-4 h-4" /> Remove Account
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Balance Update Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {editBalance && <BalanceUpdateModal account={editBalance} onClose={() => setEditBalance(null)} />}
      </AnimatePresence>

      {/* ── Add Account Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(24,18,14,0.55)' }} onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-foreground">Add Bank Account</h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                  <X className="w-4 h-4" style={{ color: '#18120E' }} />
                </button>
              </div>
              <form onSubmit={handleSubmit(d => createAccount.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Nickname *</label>
                    <input {...register('nickname', { required: true })} placeholder="My HDFC Savings" />
                  </div>
                  <div>
                    <label className="field-label">Bank</label>
                    <Controller name="bank_name" control={control} render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange} options={BANKS.map(b => ({ value: b, label: b }))} />
                    )} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Account Type</label>
                    <Controller name="account_type" control={control} render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange} options={ACCOUNT_TYPES} />
                    )} />
                  </div>
                  <div>
                    <label className="field-label">Last 4 Digits</label>
                    <input {...register('account_number_last4')} maxLength={4} placeholder="1234" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Current Balance (₹)</label>
                  <input type="number" step="0.01" {...register('current_balance', { valueAsNumber: true })} placeholder="50000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Min Balance (₹)</label>
                    <input type="number" {...register('minimum_balance', { valueAsNumber: true })} placeholder="10000" />
                  </div>
                  <div>
                    <label className="field-label">Interest Rate %</label>
                    <input type="number" step="0.01" {...register('interest_rate', { valueAsNumber: true })} placeholder="3.5" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Color</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {ACCOUNT_COLORS.map(c => (
                      <button key={c} type="button"
                        onClick={() => reset({ ...watch(), account_color: c })}
                        className="w-8 h-8 rounded-xl transition-transform hover:scale-110"
                        style={{ background: c, outline: watchColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF8F2] border border-border">
                  <input type="checkbox" id="is_primary" {...register('is_primary')} className="w-4 h-4 accent-orange-500" />
                  <label htmlFor="is_primary" className="text-sm font-medium text-foreground cursor-pointer">Set as primary account</label>
                </div>
                <button type="submit" disabled={createAccount.isPending} className="btn-primary w-full justify-center py-2.5">
                  {createAccount.isPending ? 'Adding…' : 'Add Account'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
