'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { friendsApi } from '@/lib/api'
import { Friend, EMI } from '@/types'
import { formatCurrencyCompact, formatDate, riskBadge } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Users, Plus, X, TrendingDown, AlertTriangle, CheckCircle, MessageCircle, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

const AVATAR_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#22c55e', '#06b6d4', '#eab308']

export default function FriendsPage() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Friend | null>(null)
  const qc = useQueryClient()

  const { data: friends = [], isLoading } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: async () => (await friendsApi.list()).data,
  })

  const { data: intelligence } = useQuery({
    queryKey: ['friend-intelligence'],
    queryFn: async () => (await friendsApi.intelligence()).data,
  })

  const { data: friendEMIs = [] } = useQuery<EMI[]>({
    queryKey: ['friend-emis', selected?.id],
    queryFn: async () => (await friendsApi.emis(selected!.id)).data,
    enabled: !!selected,
  })

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { name: '', phone: '', whatsapp: '', relation: 'FRIEND', avatar_color: '#6366f1' },
  })

  const createFriend = useMutation({
    mutationFn: (data: unknown) => friendsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      toast.success('Contact added')
      setShowForm(false)
      reset()
    },
  })

  const totalPending = friends.reduce((s, f) => s + Number(f.total_pending), 0)
  const highRisk = friends.filter((f) => f.risk_level === 'HIGH')

  return (
    <AppShell>
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={Users}
          title="Friend EMI Intelligence"
          subtitle={`${friends.length} contacts · ${formatCurrencyCompact(totalPending)} receivable`}
          actions={
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          }
        />

        {/* Intelligence KPIs */}
        {intelligence && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Receivable', value: formatCurrencyCompact(intelligence.total_receivable), icon: TrendingDown, variant: intelligence.total_receivable > 0 ? 'warning' : 'default' },
              { label: 'High Risk', value: intelligence.high_risk_count.toString(), icon: AlertTriangle, variant: intelligence.high_risk_count > 0 ? 'danger' : 'default' },
              { label: 'Active EMIs', value: intelligence.active_friend_emis.toString(), icon: CheckCircle },
              { label: 'Due in 7 Days', value: intelligence.upcoming_7days.toString(), icon: AlertTriangle, variant: intelligence.upcoming_7days > 0 ? 'warning' : 'default' },
            ].map((item) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={cn('glass-card p-4 border', {
                  'border-danger/20 bg-danger/5': item.variant === 'danger',
                  'border-warning/20 bg-warning/5': item.variant === 'warning',
                  'border-white/10': !item.variant || item.variant === 'default',
                })}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <div className="text-xl font-bold font-mono text-foreground">{item.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upcoming collections */}
        {intelligence?.upcoming_collections?.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Upcoming Collections (7 days)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {intelligence.upcoming_collections.map((col: any) => (
                <div key={col.emi_id} className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <div className="font-medium text-sm text-foreground">{col.product}</div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Due {formatDate(col.due_date)}</span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrencyCompact(col.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 glass-card shimmer-bg" />)
          ) : friends.length > 0 ? (
            friends.map((friend, i) => (
              <motion.div key={friend.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-5 cursor-pointer hover:border-white/20 transition-all group"
                onClick={() => setSelected(friend)}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${friend.avatar_color}, ${friend.avatar_color}99)` }}>
                    {friend.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{friend.name}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', {
                        'badge-risk-high': friend.risk_level === 'HIGH',
                        'badge-risk-medium': friend.risk_level === 'MEDIUM',
                        'badge-risk-low': friend.risk_level === 'LOW',
                      })}>{friend.risk_level}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{friend.relation} · {Number(friend.active_emi_count)} active EMIs</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-sm font-mono font-semibold text-foreground">{formatCurrencyCompact(Number(friend.total_emi_amount))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Collected</div>
                    <div className="text-sm font-mono font-semibold text-success">{formatCurrencyCompact(Number(friend.total_collected))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                    <div className="text-sm font-mono font-semibold text-warning">{formatCurrencyCompact(Number(friend.total_pending))}</div>
                  </div>
                </div>

                {friend.whatsapp && (
                  <div className="mt-3 flex gap-2">
                    <a href={`https://wa.me/${friend.whatsapp.replace(/\D/g, '')}?text=Hi ${friend.name}, friendly reminder about your EMI payment this month 🙏`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors">
                      <MessageCircle className="w-3 h-3" /> WhatsApp Reminder
                    </a>
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="col-span-3 glass-card p-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No contacts yet</h3>
              <p className="text-muted-foreground text-sm mt-2 mb-6">Add friends/family whose EMIs you're tracking</p>
              <button onClick={() => setShowForm(true)}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
                Add Contact
              </button>
            </div>
          )}
        </div>

        {/* Friend Detail Drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelected(null)}>
              <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                      style={{ background: selected.avatar_color }}>
                      {selected.name[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{selected.name}</h3>
                      <div className="text-xs text-muted-foreground">{selected.relation}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Total EMI', value: formatCurrencyCompact(Number(selected.total_emi_amount)), color: 'text-foreground' },
                    { label: 'Collected', value: formatCurrencyCompact(Number(selected.total_collected)), color: 'text-success' },
                    { label: 'Pending', value: formatCurrencyCompact(Number(selected.total_pending)), color: 'text-warning' },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 rounded-xl bg-white/3">
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className={cn('text-sm font-bold font-mono mt-1', s.color)}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <h4 className="text-sm font-semibold text-foreground mb-3">EMI Schedule</h4>
                {friendEMIs.length > 0 ? (
                  <div className="space-y-3">
                    {friendEMIs.map((emi) => (
                      <div key={emi.id} className="p-3 rounded-xl bg-white/3 border border-border/50">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-foreground">{emi.product_name}</span>
                          <span className="text-sm font-mono text-foreground">{formatCurrencyCompact(Number(emi.monthly_emi))}/mo</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{emi.paid_months}/{emi.tenure_months} months</span>
                          <span className={cn(emi.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground')}>{emi.status}</span>
                        </div>
                        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full"
                            style={{ width: `${(emi.paid_months / emi.tenure_months) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No EMIs linked to this contact</p>
                )}

                {selected.whatsapp && (
                  <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}?text=Hi ${selected.name}! Friendly reminder about your EMI payment. Please let me know when done 🙏`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/20 text-green-400 font-medium text-sm hover:bg-green-500/30 transition-colors">
                    <MessageCircle className="w-4 h-4" /> Send WhatsApp Reminder
                  </a>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Contact Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowForm(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-foreground">Add Contact</h3>
                  <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit((d) => createFriend.mutate(d))} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name *</label>
                    <input {...register('name', { required: true })} placeholder="Contact name"
                      className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</label>
                      <input {...register('phone')} placeholder="+91 9999999999"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp</label>
                      <input {...register('whatsapp')} placeholder="+91 9999999999"
                        className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relation</label>
                    <select {...register('relation')}
                      className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                      {['FRIEND', 'FAMILY', 'COLLEAGUE', 'OTHER'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avatar Color</label>
                    <div className="flex gap-2 mt-2">
                      {AVATAR_COLORS.map((color) => (
                        <label key={color} className="cursor-pointer">
                          <input {...register('avatar_color')} type="radio" value={color} className="sr-only" />
                          <div className={`w-6 h-6 rounded-full transition-all ${watch('avatar_color') === color ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : ''}`}
                            style={{ background: color }} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-white/5">
                      Cancel
                    </button>
                    <button type="submit" disabled={createFriend.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium disabled:opacity-50">
                      {createFriend.isPending ? 'Adding…' : 'Add Contact'}
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
