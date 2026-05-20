'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { CreditCardWidget } from '@/components/cards/CreditCardWidget'
import { cardsApi } from '@/lib/api'
import { CreditCard as CreditCardType } from '@/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { CreditCard, Plus, X, TrendingUp, Percent, Gift, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

const CARD_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']
const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Amex', 'IDFC', 'OneCard', 'AU', 'Kotak', 'Federal', 'Standard Chartered', 'Other']
const NETWORKS = ['VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS', 'OTHER']

export default function CardsPage() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<CreditCardType | null>(null)
  const qc = useQueryClient()

  const { data: cards = [], isLoading } = useQuery<CreditCardType[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { card_color: '#6366f1', network: 'VISA', billing_cycle_day: 1, due_date_day: 25 },
  })

  const createCard = useMutation({
    mutationFn: (data: unknown) => cardsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Card added successfully')
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

  return (
    <AppShell>
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={CreditCard}
          title="Credit Cards"
          subtitle={`${cards.length} card${cards.length !== 1 ? 's' : ''} · ${formatCurrencyCompact(totalOutstanding)} outstanding`}
          actions={
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Card
            </button>
          }
        />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Limit', value: formatCurrencyCompact(totalLimit), icon: CreditCard },
            { label: 'Outstanding', value: formatCurrencyCompact(totalOutstanding), icon: TrendingUp },
            { label: 'Available', value: formatCurrencyCompact(totalAvailable), icon: Percent },
          ].map((item) => (
            <div key={item.label} className="glass-card p-4 flex items-center gap-3">
              <item.icon className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-lg font-bold font-mono text-foreground">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white/5 shimmer-bg" />
            ))}
          </div>
        ) : cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, i) => (
              <CreditCardWidget key={card.id} card={card} delay={i * 0.05} onClick={() => setSelected(card)} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-16 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No cards yet</h3>
            <p className="text-muted-foreground text-sm mt-2 mb-6">Add your first credit card to start tracking</p>
            <button onClick={() => setShowForm(true)}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors">
              Add Your First Card
            </button>
          </div>
        )}

        {/* Card Detail Drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
              onClick={() => setSelected(null)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-lg p-6 space-y-5"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-foreground">{selected.nickname}</h3>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <CreditCardWidget card={selected} />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Bank', selected.bank_name],
                    ['Network', selected.network],
                    ['Last 4', selected.last_four],
                    ['Interest Rate', `${selected.interest_rate}% p.a.`],
                    ['Billing Cycle', `Day ${selected.billing_cycle_day}`],
                    ['Due Date', `Day ${selected.due_date_day}`],
                    ['Annual Fee', formatCurrency(selected.annual_fee)],
                    ['Reward Rate', `${selected.reward_rate} pts/₹100`],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-white/3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => deleteCard.mutate(selected.id)}
                    className="flex-1 py-2.5 rounded-xl border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
                  >
                    Remove Card
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Card Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-foreground">Add Credit Card</h3>
                  <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit((d) => createCard.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card Nickname *</label>
                      <input {...register('nickname', { required: true })} placeholder="e.g. HDFC Millennia"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bank *</label>
                      <select {...register('bank_name', { required: true })}
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                        {BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Network</label>
                      <select {...register('network')}
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                        {NETWORKS.map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last 4 Digits *</label>
                      <input {...register('last_four', { required: true, maxLength: 4 })} maxLength={4} placeholder="1234"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credit Limit</label>
                      <input {...register('credit_limit')} type="number" placeholder="100000"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interest Rate %</label>
                      <input {...register('interest_rate')} type="number" step="0.01" placeholder="42"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Billing Cycle Day</label>
                      <input {...register('billing_cycle_day')} type="number" min={1} max={31} placeholder="1"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date Day</label>
                      <input {...register('due_date_day')} type="number" min={1} max={31} placeholder="25"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card Color</label>
                    <div className="flex gap-2 mt-2">
                      {CARD_COLORS.map((color) => (
                        <label key={color} className="cursor-pointer">
                          <input {...register('card_color')} type="radio" value={color} className="sr-only" />
                          <div className={`w-6 h-6 rounded-full transition-all ${watch('card_color') === color ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : ''}`}
                            style={{ background: color }} />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-white/5 transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={createCard.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50">
                      {createCard.isPending ? 'Adding…' : 'Add Card'}
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
