'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { investmentsApi } from '@/lib/api'
import { Investment } from '@/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BarChart3, Plus, X, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const INVESTMENT_TYPES = [
  { value: 'STOCKS', label: '📈 Stocks' },
  { value: 'MUTUAL_FUND', label: '🏦 Mutual Fund' },
  { value: 'ETF', label: '📊 ETF' },
  { value: 'CRYPTO', label: '₿ Crypto' },
  { value: 'GOLD', label: '🥇 Gold' },
  { value: 'SILVER', label: '🥈 Silver' },
  { value: 'SGB', label: '🏅 SGB' },
  { value: 'PPF', label: '🏛️ PPF' },
  { value: 'EPF', label: '🏢 EPF' },
  { value: 'NPS', label: '📋 NPS' },
  { value: 'BONDS', label: '📜 Bonds' },
  { value: 'REITS', label: '🏠 REITs' },
  { value: 'OTHER', label: '💼 Other' },
]

const TYPE_EMOJI: Record<string, string> = {
  STOCKS: '📈', MUTUAL_FUND: '🏦', ETF: '📊', CRYPTO: '₿',
  GOLD: '🥇', SILVER: '🥈', SGB: '🏅', PPF: '🏛️',
  EPF: '🏢', NPS: '📋', BONDS: '📜', REITS: '🏠', OTHER: '💼',
}

const PLATFORMS = ['Zerodha', 'Groww', 'Kuvera', 'Coin (Zerodha)', 'Angel One', 'Upstox', 'MF Central', 'Other']

export function InvestmentsView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Investment | null>(null)
  const qc = useQueryClient()

  const { data: investments = [], isLoading } = useQuery<Investment[]>({
    queryKey: ['investments'],
    queryFn: async () => (await investmentsApi.list()).data,
  })

  const { data: summary } = useQuery<{
    total_invested: number
    total_current_value: number
    total_pnl: number
    pnl_pct: number
    by_type: { type: string; invested: number; current: number; count: number }[]
  }>({
    queryKey: ['investments-summary'],
    queryFn: async () => (await investmentsApi.summary()).data,
  })

  const { register, handleSubmit, reset, watch, control } = useForm({
    defaultValues: {
      investment_type: 'MUTUAL_FUND', name: '', symbol: '',
      units: 0, avg_buy_price: 0, current_price: 0,
      invested_amount: 0, is_sip: false, sip_amount: 0, sip_date: 1,
      broker: '', platform: 'Groww', notes: '',
    },
  })

  const createInvestment = useMutation({
    mutationFn: (data: unknown) => investmentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['investments-summary'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      toast.success('Investment added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add investment'),
  })

  const deleteInvestment = useMutation({
    mutationFn: (id: string) => investmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['investments-summary'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      setSelected(null)
      toast.success('Investment removed')
    },
  })

  const isSip = watch('is_sip')
  const pnl = summary?.total_pnl ?? 0

  // Group by type for display
  const byType = investments.reduce<Record<string, Investment[]>>((acc, inv) => {
    const t = inv.investment_type
    if (!acc[t]) acc[t] = []
    acc[t].push(inv)
    return acc
  }, {})

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Investments"
        subtitle={`${investments.length} holdings`}
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Investment
          </button>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Invested" value={formatCurrencyCompact(summary?.total_invested ?? 0)} icon={BarChart3} variant="violet" delay={0} />
          <StatCard title="Current Value" value={formatCurrencyCompact(summary?.total_current_value ?? 0)} icon={TrendingUp} variant="info" delay={0.05} />
          <StatCard title="P&L" value={`${pnl >= 0 ? '+' : ''}${formatCurrencyCompact(pnl)}`} icon={pnl >= 0 ? TrendingUp : TrendingDown} variant={pnl >= 0 ? 'success' : 'danger'} delay={0.1} />
          <StatCard title="Returns" value={`${summary?.pnl_pct != null ? (summary.pnl_pct >= 0 ? '+' : '') + summary.pnl_pct.toFixed(1) + '%' : '—'}`} icon={RefreshCw} variant={pnl >= 0 ? 'success' : 'danger'} delay={0.15} />
        </div>

        {/* Investment list by type */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-[#FFF1E6] shimmer" />)}
          </div>
        ) : investments.length ? (
          <div className="space-y-6">
            {Object.entries(byType).map(([type, items]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{TYPE_EMOJI[type] ?? '💼'}</span>
                  <h3 className="text-sm font-bold text-foreground">{type.replace('_', ' ')}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="card overflow-hidden">
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th className="text-right">Invested</th>
                          <th className="text-right">Current</th>
                          <th className="text-right">P&L</th>
                          <th>Platform</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(inv => {
                          const pl = Number(inv.unrealized_pnl)
                          return (
                            <tr key={inv.id} onClick={() => setSelected(inv)} className="cursor-pointer">
                              <td>
                                <div className="font-medium text-sm text-foreground">{inv.name}</div>
                                {inv.symbol && <div className="text-xs text-muted-foreground">{inv.symbol}</div>}
                              </td>
                              <td className="text-right font-mono text-sm">{formatCurrencyCompact(Number(inv.invested_amount))}</td>
                              <td className="text-right font-mono text-sm font-semibold">{formatCurrencyCompact(Number(inv.current_value))}</td>
                              <td className="text-right">
                                <span className={cn('font-mono text-sm font-bold', pl >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                                  {pl >= 0 ? '+' : ''}{formatCurrencyCompact(pl)}
                                </span>
                              </td>
                              <td className="text-xs text-muted-foreground">{inv.platform ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F3E8FF, #DDD6FE)', border: '2px solid #C4B5FD' }}>
              <BarChart3 className="w-7 h-7 text-violet-600" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No investments tracked yet</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Add stocks, mutual funds, gold & more</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Investment
            </button>
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }}
              onClick={() => setSelected(null)}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-lg font-bold text-foreground">{TYPE_EMOJI[selected.investment_type]} {selected.name}</div>
                    <div className="text-xs text-muted-foreground">{selected.investment_type} · {selected.platform}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Invested', formatCurrency(Number(selected.invested_amount))],
                    ['Current Value', formatCurrency(Number(selected.current_value))],
                    ['P&L', `${Number(selected.unrealized_pnl) >= 0 ? '+' : ''}${formatCurrency(Number(selected.unrealized_pnl))}`],
                    ['Units', Number(selected.units).toLocaleString()],
                    ['Avg Price', `₹${Number(selected.avg_buy_price).toLocaleString()}`],
                    ['Current Price', `₹${Number(selected.current_price).toLocaleString()}`],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className={cn("text-sm font-semibold font-mono", label === 'P&L' ? (Number(selected.unrealized_pnl) >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-foreground')}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {selected.is_sip && (
                  <div className="mb-5 p-3 rounded-xl bg-violet-50 border border-violet-100">
                    <div className="text-xs font-bold text-violet-600 mb-1">SIP Active</div>
                    <div className="text-sm text-foreground">₹{Number(selected.sip_amount ?? 0).toLocaleString()} on {selected.sip_date}th of every month</div>
                  </div>
                )}

                <button
                  onClick={() => deleteInvestment.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Investment
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }}
              onClick={() => setShowForm(false)}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Add Investment</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <form onSubmit={handleSubmit(d => createInvestment.mutate(d))} className="space-y-4">
                  <div>
                    <label className="field-label">Type</label>
                    <Controller name="investment_type" control={control} render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange} options={INVESTMENT_TYPES} />
                    )} />
                  </div>
                  <div>
                    <label className="field-label">Name *</label>
                    <input {...register('name', { required: true })} placeholder="Axis Bluechip Fund / Reliance Industries" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Symbol / ISIN</label>
                      <input {...register('symbol')} placeholder="RELIANCE / INF…" />
                    </div>
                    <div>
                      <label className="field-label">Platform</label>
                      <Controller name="platform" control={control} render={({ field }) => (
                        <Select value={field.value} onChange={field.onChange} options={PLATFORMS.map(p => ({ value: p, label: p }))} />
                      )} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Invested Amount (₹)</label>
                    <input type="number" step="0.01" {...register('invested_amount', { valueAsNumber: true })} placeholder="50000" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Units / Shares</label>
                      <input type="number" step="0.0001" {...register('units', { valueAsNumber: true })} placeholder="10.5" />
                    </div>
                    <div>
                      <label className="field-label">Current Price (₹)</label>
                      <input type="number" step="0.01" {...register('current_price', { valueAsNumber: true })} placeholder="1500" />
                    </div>
                  </div>

                  {/* SIP toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF8F2] border border-border">
                    <input type="checkbox" id="is_sip" {...register('is_sip')} className="w-4 h-4 accent-orange-500" />
                    <label htmlFor="is_sip" className="text-sm font-medium text-foreground cursor-pointer">This is a SIP / recurring investment</label>
                  </div>
                  {isSip && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">Monthly SIP Amount (₹)</label>
                        <input type="number" {...register('sip_amount', { valueAsNumber: true })} placeholder="5000" />
                      </div>
                      <div>
                        <label className="field-label">SIP Date (day of month)</label>
                        <input type="number" min={1} max={31} {...register('sip_date', { valueAsNumber: true })} placeholder="5" />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={createInvestment.isPending} className="btn-primary w-full justify-center py-2.5">
                    {createInvestment.isPending ? 'Adding…' : 'Add Investment'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
