'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { EMIForecastChart } from '@/components/charts/EMIForecastChart'
import { emisApi, cardsApi, friendsApi } from '@/lib/api'
import { EMI, CreditCard, Friend } from '@/types'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Calendar, Plus, X, CheckCircle, Clock, AlertCircle, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

const STATUS_META = {
  ACTIVE: { label: 'Active', color: 'text-success', bg: 'bg-success/10 border-success/20' },
  COMPLETED: { label: 'Completed', color: 'text-muted-foreground', bg: 'bg-white/5 border-border' },
  PRECLOSED: { label: 'Pre-closed', color: 'text-info', bg: 'bg-info/10 border-info/20' },
  DEFAULTED: { label: 'Defaulted', color: 'text-danger', bg: 'bg-danger/10 border-danger/20' },
}

const OWNER_META = {
  SELF: { label: 'Self', icon: '👤', color: 'text-foreground' },
  FRIEND: { label: 'Friend', icon: '👥', color: 'text-info' },
  FAMILY: { label: 'Family', icon: '🏠', color: 'text-purple-400' },
  OFFICE: { label: 'Office', icon: '🏢', color: 'text-warning' },
  SHARED: { label: 'Shared', icon: '🤝', color: 'text-success' },
}

export default function EMIsPage() {
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

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      product_name: '', purchase_amount: 0, total_amount: 0, monthly_emi: 0,
      tenure_months: 12, purchase_date: '', interest_rate: 0,
      card_id: '', friend_id: '', owner_type: 'SELF', is_no_cost_emi: false,
    },
  })

  const createEMI = useMutation({
    mutationFn: (data: unknown) => emisApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emis'] })
      qc.invalidateQueries({ queryKey: ['emi-forecast'] })
      toast.success('EMI added successfully')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add EMI'),
  })

  const totalMonthly = emis.filter((e) => e.status === 'ACTIVE').reduce((s, e) => s + Number(e.monthly_emi), 0)
  const totalOutstanding = emis.filter((e) => e.status === 'ACTIVE').reduce((s, e) => s + Number(e.amount_remaining ?? 0), 0)
  const selfEMIs = emis.filter((e) => e.owner_type === 'SELF')
  const friendEMIs = emis.filter((e) => e.owner_type !== 'SELF')

  return (
    <AppShell>
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={Calendar}
          title="EMI Tracker"
          subtitle={`${emis.filter((e) => e.status === 'ACTIVE').length} active EMIs · ${formatCurrencyCompact(totalMonthly)}/month`}
          actions={
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add EMI
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Monthly Burden', value: formatCurrencyCompact(totalMonthly), sub: 'total EMIs', icon: Calendar },
            { label: 'Total Outstanding', value: formatCurrencyCompact(totalOutstanding), sub: 'remaining', icon: TrendingDown },
            { label: 'Personal EMIs', value: selfEMIs.length.toString(), sub: 'active', icon: CheckCircle },
            { label: 'Friend/Family', value: friendEMIs.length.toString(), sub: 'being tracked', icon: Clock },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <div className="text-xl font-bold font-mono text-foreground">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Forecast */}
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly EMI Forecast</h2>
          <EMIForecastChart data={forecast} />
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-4">
          {['ACTIVE', 'COMPLETED', 'PRECLOSED', 'DEFAULTED'].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                filterStatus === s ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:text-foreground')}>
              {STATUS_META[s as keyof typeof STATUS_META]?.label ?? s}
            </button>
          ))}
        </div>

        {/* EMI List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 glass-card shimmer-bg" />)
          ) : emis.length > 0 ? (
            emis.map((emi, i) => {
              const progress = emi.tenure_months > 0 ? (emi.paid_months / emi.tenure_months) * 100 : 0
              const card = cards.find((c) => c.id === emi.card_id)
              const ownerMeta = OWNER_META[emi.owner_type]
              const statusMeta = STATUS_META[emi.status]

              return (
                <motion.div key={emi.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={cn('glass-card p-5 border cursor-pointer hover:border-white/20 transition-all', statusMeta.bg)}
                  onClick={() => setSelected(emi)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{emi.product_name}</span>
                        <span className={cn('text-xs font-medium', ownerMeta.color)}>
                          {ownerMeta.icon} {ownerMeta.label}
                        </span>
                        {emi.is_no_cost_emi && (
                          <span className="text-xs bg-success/20 text-success border border-success/30 px-1.5 py-0.5 rounded-full">No-cost</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {card ? `${card.bank_name} ···${card.last_four}` : 'No card linked'} ·
                        {emi.merchant_name ? ` ${emi.merchant_name} ·` : ''} {formatDate(emi.purchase_date)}
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{emi.paid_months} of {emi.tenure_months} months paid</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="h-full rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold font-mono text-foreground">{formatCurrencyCompact(Number(emi.monthly_emi))}</div>
                      <div className="text-xs text-muted-foreground">per month</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatCurrencyCompact(Number(emi.amount_remaining ?? 0))} left
                      </div>
                      {emi.next_due_date && (
                        <div className="text-xs text-warning mt-1">Due {formatDate(emi.next_due_date)}</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          ) : (
            <div className="glass-card p-16 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No {filterStatus.toLowerCase()} EMIs</h3>
              <p className="text-muted-foreground text-sm mt-2 mb-6">
                {filterStatus === 'ACTIVE' ? 'Add your first EMI to start tracking' : `No ${filterStatus.toLowerCase()} EMIs found`}
              </p>
              {filterStatus === 'ACTIVE' && (
                <button onClick={() => setShowForm(true)}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
                  Add EMI
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add EMI Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowForm(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-foreground">Add EMI</h3>
                  <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit((d) => createEMI.mutate(d))} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product Name *</label>
                    <input {...register('product_name', { required: true })} placeholder="e.g. iPhone 16 Pro"
                      className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Amount *</label>
                      <input {...register('purchase_amount', { required: true })} type="number" placeholder="99999"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total EMI Amount</label>
                      <input {...register('total_amount', { required: true })} type="number" placeholder="99999"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly EMI *</label>
                      <input {...register('monthly_emi', { required: true })} type="number" placeholder="8333"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenure (months)</label>
                      <input {...register('tenure_months')} type="number" placeholder="12"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase Date *</label>
                      <input {...register('purchase_date', { required: true })} type="date"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interest Rate %</label>
                      <input {...register('interest_rate')} type="number" step="0.01" placeholder="0"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card</label>
                      <select {...register('card_id')}
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                        <option value="">No card linked</option>
                        {cards.map((c) => <option key={c.id} value={c.id}>{c.nickname}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner Type</label>
                      <select {...register('owner_type')}
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                        {Object.entries(OWNER_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {watch('owner_type') !== 'SELF' && friends.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Person</label>
                      <select {...register('friend_id')}
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                        <option value="">Select person</option>
                        {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input {...register('is_no_cost_emi')} type="checkbox" id="no_cost"
                      className="w-4 h-4 accent-primary" />
                    <label htmlFor="no_cost" className="text-sm text-muted-foreground cursor-pointer">No-cost EMI</label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-white/5">
                      Cancel
                    </button>
                    <button type="submit" disabled={createEMI.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium disabled:opacity-50">
                      {createEMI.isPending ? 'Adding…' : 'Add EMI'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
