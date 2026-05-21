'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { emisApi, cardsApi, friendsApi } from '@/lib/api'
import { EMI, CreditCard, Friend } from '@/types'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Calendar, Plus, X, CheckCircle, Clock, AlertCircle, TrendingDown } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const STATUS_CFG = {
  ACTIVE:    { label: 'Active',     cls: 'badge-success' },
  COMPLETED: { label: 'Completed',  cls: 'badge-neutral' },
  PRECLOSED: { label: 'Pre-closed', cls: 'badge-info'    },
  DEFAULTED: { label: 'Defaulted',  cls: 'badge-danger'  },
}

const OWNER_CFG = {
  SELF:   { label: 'Self',   icon: '👤' },
  FRIEND: { label: 'Friend', icon: '👥' },
  FAMILY: { label: 'Family', icon: '🏠' },
  OFFICE: { label: 'Office', icon: '🏢' },
  SHARED: { label: 'Shared', icon: '🤝' },
}

export function EMIsView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<EMI | null>(null)
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const qc = useQueryClient()

  const { data: emis = [], isLoading } = useQuery<EMI[]>({
    queryKey: ['emis', filterStatus],
    queryFn: async () => (await emisApi.list({ status: filterStatus })).data,
  })
  const { data: forecast = [] } = useQuery({
    queryKey: ['emi-forecast'],
    queryFn: async () => (await emisApi.forecast(6)).data,
  })
  const { data: cards = [] } = useQuery<CreditCard[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: async () => (await friendsApi.list()).data,
  })

  const { register, handleSubmit, reset, watch, control } = useForm({
    defaultValues: {
      product_name: '', purchase_amount: 0, total_amount: 0,
      monthly_emi: 0, tenure_months: 12, purchase_date: '',
      interest_rate: 0, card_id: '', friend_id: '',
      owner_type: 'SELF', is_no_cost_emi: false,
    },
  })

  const createEMI = useMutation({
    mutationFn: (raw: Record<string, unknown>) => {
      // purchase_date is required by backend — default to today if blank
      const today = new Date().toISOString().slice(0, 10)
      const data = {
        ...raw,
        purchase_date: raw.purchase_date || today,
        // auto-fill total_amount from monthly_emi × tenure if not set
        total_amount: Number(raw.total_amount) > 0
          ? raw.total_amount
          : Number(raw.monthly_emi) * Number(raw.tenure_months),
        // strip empty strings for optional FK fields
        card_id: raw.card_id || undefined,
        friend_id: raw.friend_id || undefined,
      }
      return emisApi.create(data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emis'] })
      qc.invalidateQueries({ queryKey: ['emi-forecast'] })
      toast.success('EMI added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add EMI'),
  })

  const activeEMIs = emis.filter((e) => e.status === 'ACTIVE')
  const totalMonthly = activeEMIs.reduce((s, e) => s + Number(e.monthly_emi), 0)
  const totalOutstanding = activeEMIs.reduce((s, e) => s + Number(e.amount_remaining ?? 0), 0)

  return (
    <>
      <PageHeader
          icon={Calendar}
          title="EMI Tracker"
          subtitle={`${activeEMIs.length} active EMIs`}
          actions={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add EMI
            </button>
          }
        />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Monthly Burden"  value={formatCurrencyCompact(totalMonthly)}    variant="violet"  delay={0}    />
          <StatCard title="Total Outstanding" value={formatCurrencyCompact(totalOutstanding)} variant={totalOutstanding > 200000 ? 'warning' : 'default'} delay={0.05} />
          <StatCard title="Active EMIs"     value={String(activeEMIs.length)}              delay={0.1}  />
          <StatCard title="Self EMIs"       value={String(activeEMIs.filter(e => e.owner_type === 'SELF').length)} variant="success" delay={0.15} />
        </div>

        {/* Forecast */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">6-Month Forecast</h2>
              <p className="section-sub">Upcoming EMI burden</p>
            </div>
          </div>
          <EMIForecastChart data={forecast} />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
          {['ACTIVE', 'COMPLETED', 'PRECLOSED', 'DEFAULTED'].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap',
                filterStatus === s
                  ? 'bg-orange-500 text-white border border-orange-600 shadow-sm'
                  : 'text-[#6B6460] hover:text-[#18120E] bg-white border border-[#C8C2BB] hover:border-orange-300')}>
              {s}
            </button>
          ))}
        </div>

        {/* EMI cards */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#FFF1E6] shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : emis.length ? (
          <div className="space-y-3">
            {emis.map((emi, i) => {
              const progress = emi.tenure_months > 0 ? (emi.paid_months / emi.tenure_months) * 100 : 0
              const ownerCfg = OWNER_CFG[emi.owner_type as keyof typeof OWNER_CFG] ?? OWNER_CFG.SELF
              const statusCfg = STATUS_CFG[emi.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.ACTIVE
              const card = cards.find((c) => c.id === emi.card_id)
              return (
                <motion.div
                  key={emi.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(emi)}
                  className="card p-5 cursor-pointer hover:border-orange-200 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '1.5px solid #FDC888' }}>
                      {ownerCfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{emi.product_name}</span>
                        <span className={statusCfg.cls}>{statusCfg.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        {card ? `${card.bank_name} ···${card.last_four}` : ownerCfg.label} ·
                        Started {formatDate(emi.start_date ?? emi.purchase_date)} ·
                        {emi.paid_months}/{emi.tenure_months} months
                      </div>
                      <div className="progress-track">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ delay: i * 0.04 + 0.3, duration: 0.6, ease: 'easeOut' }}
                          className="progress-fill"
                          style={{ background: emi.status === 'COMPLETED' ? '#10B981' : 'linear-gradient(90deg, #7C3AED, #6366F1)' }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold font-mono text-foreground">
                        {formatCurrencyCompact(Number(emi.monthly_emi))}<span className="text-xs text-muted-foreground font-normal">/mo</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatCurrencyCompact(Number(emi.amount_remaining ?? 0))} left
                      </div>
                      {emi.next_due_date && (
                        <div className="text-xs text-amber-400 mt-0.5">Due {formatDate(emi.next_due_date, 'dd MMM')}</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '2px solid #FDC888' }}>
              <Calendar className="w-6 h-6" style={{ color: '#EA580C' }} strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No {filterStatus.toLowerCase()} EMIs</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Add your first EMI to start tracking</p>
            </div>
          </div>
        )}

        {/* EMI detail modal */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-foreground">{selected.product_name}</h2>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Purchase Price', formatCurrency(Number(selected.purchase_amount))],
                    ['Total Payable', formatCurrency(Number(selected.total_amount))],
                    ['Monthly EMI', formatCurrency(Number(selected.monthly_emi))],
                    ['Tenure', `${selected.tenure_months} months`],
                    ['Paid', `${selected.paid_months} months`],
                    ['Remaining', `${selected.remaining_months ?? 0} months`],
                    ['Interest', formatCurrency(Number(selected.total_interest))],
                    ['Amount Paid', formatCurrency(Number(selected.amount_paid))],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="divider" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Schedule</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {selected.payments?.map((p) => (
                    <div key={p.id} className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs',
                      p.is_paid ? 'bg-[#F0FDF4]' : p.is_overdue ? 'bg-[#FEF2F2]' : 'bg-[#FFF8F2]',
                    )}>
                      <div className="flex items-center gap-2">
                        {p.is_paid
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          : p.is_overdue
                            ? <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            : <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                        <span className="text-muted-foreground">#{p.installment_no} · {formatDate(p.due_date, 'dd MMM yyyy')}</span>
                      </div>
                      <span className={cn('font-mono font-semibold',
                        p.is_paid ? 'text-emerald-400' : p.is_overdue ? 'text-rose-400' : 'text-foreground')}>
                        {formatCurrency(Number(p.expected_amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add EMI modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }}
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Add EMI</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <form onSubmit={handleSubmit((d) => createEMI.mutate(d))} className="space-y-4">
                  <div>
                    <label className="field-label">Product Name *</label>
                    <input {...register('product_name', { required: true })} placeholder="iPhone 15 Pro" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Purchase Price (₹)</label>
                      <input type="number" {...register('purchase_amount', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="field-label">Total Payable (₹)</label>
                      <input type="number" {...register('total_amount', { valueAsNumber: true })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Monthly EMI (₹)</label>
                      <input type="number" {...register('monthly_emi', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="field-label">Tenure (months)</label>
                      <input type="number" {...register('tenure_months', { valueAsNumber: true })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Purchase Date</label>
                      <input type="date" {...register('purchase_date')} />
                    </div>
                    <div>
                      <label className="field-label">Interest Rate (% p.a.)</label>
                      <input type="number" step="0.01" {...register('interest_rate', { valueAsNumber: true })} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Card</label>
                    <Controller name="card_id" control={control} render={({ field }) => (
                      <Select value={field.value ?? ''} onChange={field.onChange}
                        options={[{ value: '', label: 'Select card…' }, ...cards.map((c) => ({ value: c.id, label: `${c.nickname} ···${c.last_four}` }))]} />
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Owner Type</label>
                      <Controller name="owner_type" control={control} render={({ field }) => (
                        <Select value={field.value} onChange={field.onChange}
                          options={Object.entries(OWNER_CFG).map(([k, v]) => ({ value: k, label: v.label, icon: v.icon }))} />
                      )} />
                    </div>
                    <div>
                      <label className="field-label">Friend (if applicable)</label>
                      <Controller name="friend_id" control={control} render={({ field }) => (
                        <Select value={field.value ?? ''} onChange={field.onChange}
                          options={[{ value: '', label: 'None' }, ...friends.map((f) => ({ value: f.id, label: f.name }))]} />
                      )} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('is_no_cost_emi')} className="w-4 h-4 rounded accent-orange-500" />
                    <span className="text-sm text-foreground">No-cost EMI</span>
                  </label>

                  <button type="submit" disabled={createEMI.isPending} className="btn-primary w-full justify-center py-2.5 mt-2">
                    {createEMI.isPending ? 'Adding…' : 'Add EMI'}
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

