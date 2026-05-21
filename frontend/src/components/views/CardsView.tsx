'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { CreditCardWidget } from '@/components/cards/CreditCardWidget'
import { StatCard } from '@/components/ui/StatCard'
import { cardsApi } from '@/lib/api'
import { CreditCard as CreditCardType } from '@/types'
import { formatCurrencyCompact } from '@/lib/utils'
import { CreditCard, Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Amex', 'IDFC', 'OneCard', 'AU', 'Kotak', 'Federal', 'Standard Chartered', 'Other']
const NETWORKS = ['VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS', 'OTHER']
const CARD_COLORS = ['#F97316', '#EA580C', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#7C3AED', '#14B8A6']

export function CardsView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<CreditCardType | null>(null)
  const qc = useQueryClient()

  const { data: cards = [], isLoading } = useQuery<CreditCardType[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const { register, handleSubmit, reset, watch, control } = useForm({
    defaultValues: {
      nickname: '', bank_name: 'HDFC', last_four: '', card_color: '#F97316',
      network: 'VISA', billing_cycle_day: 1, due_date_day: 25,
      credit_limit: 0, interest_rate: 0,
    },
  })

  const createCard = useMutation({
    mutationFn: (data: unknown) => cardsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Card added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add card'),
  })

  const deleteCard = useMutation({
    mutationFn: (id: string) => cardsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      setSelected(null)
      toast.success('Card removed')
    },
  })

  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0)
  const totalOutstanding = cards.reduce((s, c) => s + Number(c.current_outstanding), 0)
  const totalAvailable = cards.reduce((s, c) => s + Number(c.available_limit), 0)
  const avgUtil = totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : 0
  const watchColor = watch('card_color')

  return (
    <>
      <PageHeader
          icon={CreditCard}
          title="Credit Cards"
          subtitle={`${cards.length} card${cards.length !== 1 ? 's' : ''}`}
          actions={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Card
            </button>
          }
        />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Limit"    value={formatCurrencyCompact(totalLimit)}       variant="violet"  delay={0}    />
          <StatCard title="Outstanding"    value={formatCurrencyCompact(totalOutstanding)}  variant={avgUtil > 70 ? 'danger' : avgUtil > 40 ? 'warning' : 'default'} delay={0.05} />
          <StatCard title="Available"      value={formatCurrencyCompact(totalAvailable)}    variant="success" delay={0.1}  />
          <StatCard title="Avg Utilization" value={`${avgUtil}%`}                          variant={avgUtil > 70 ? 'danger' : avgUtil > 40 ? 'warning' : 'success'} delay={0.15} />
        </div>

        {/* Cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl shimmer" style={{ aspectRatio: '16/9', backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : cards.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card, i) => (
              <CreditCardWidget key={card.id} card={card} onClick={() => setSelected(card)} delay={i * 0.06} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '2px solid #FDC888' }}>
              <CreditCard className="w-7 h-7" style={{ color: '#EA580C' }} strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No cards added yet</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Add your first credit card to start tracking</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-1">
              <Plus className="w-4 h-4" /> Add Card
            </button>
          </div>
        )}

        {/* Card detail panel */}
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
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-foreground">{selected.nickname}</h2>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <div className="mb-5">
                  <CreditCardWidget card={selected} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  {[
                    ['Network', selected.network],
                    ['Billing Day', `${selected.billing_cycle_day}th`],
                    ['Due Day', `${selected.due_date_day}th`],
                    ['Interest', `${selected.interest_rate}% p.a.`],
                    ['Reward Rate', `${selected.reward_rate}%`],
                    ['Points', selected.total_reward_points.toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: '#FFF8F2', border: '1px solid #E7E2DC' }}>
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="font-semibold text-foreground">{value}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => deleteCard.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ color: '#DC2626', border: '1px solid #FECACA', background: '#FEF2F2' }}
                >
                  <Trash2 className="w-4 h-4" /> Remove Card
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add card modal */}
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
                  <h2 className="text-base font-bold text-foreground">Add Credit Card</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <form onSubmit={handleSubmit((d) => createCard.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Card Nickname *</label>
                      <input {...register('nickname', { required: true })} placeholder="HDFC Regalia" />
                    </div>
                    <div>
                      <label className="field-label">Bank *</label>
                      <Controller name="bank_name" control={control} render={({ field }) => (
                        <Select value={field.value} onChange={field.onChange}
                          options={BANKS.map((b) => ({ value: b, label: b }))} />
                      )} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Last 4 Digits *</label>
                      <input {...register('last_four')} maxLength={4} placeholder="4242" />
                    </div>
                    <div>
                      <label className="field-label">Network</label>
                      <Controller name="network" control={control} render={({ field }) => (
                        <Select value={field.value} onChange={field.onChange}
                          options={NETWORKS.map((n) => ({ value: n, label: n }))} />
                      )} />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Credit Limit (₹)</label>
                    <input type="number" {...register('credit_limit', { valueAsNumber: true })} placeholder="100000" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Billing Cycle Day</label>
                      <input type="number" {...register('billing_cycle_day', { valueAsNumber: true })} min={1} max={31} />
                    </div>
                    <div>
                      <label className="field-label">Due Date Day</label>
                      <input type="number" {...register('due_date_day', { valueAsNumber: true })} min={1} max={31} />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Interest Rate (% p.a.)</label>
                    <input type="number" step="0.01" {...register('interest_rate', { valueAsNumber: true })} placeholder="42" />
                  </div>

                  <div>
                    <label className="field-label">Card Color</label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {CARD_COLORS.map((c) => (
                        <button key={c} type="button"
                          onClick={() => reset({ ...watch(), card_color: c })}
                          className="w-8 h-8 rounded-xl transition-transform hover:scale-110"
                          style={{ background: c, outline: watchColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={createCard.isPending} className="btn-primary w-full justify-center py-2.5 mt-2">
                    {createCard.isPending ? 'Adding…' : 'Add Card'}
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

