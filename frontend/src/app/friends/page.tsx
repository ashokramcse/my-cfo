'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { friendsApi } from '@/lib/api'
import { Friend } from '@/types'
import { formatCurrencyCompact, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Users, Plus, X, Phone, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'

const RISK_CFG = {
  LOW:    { cls: 'badge-success', label: 'Low risk'    },
  MEDIUM: { cls: 'badge-warning', label: 'Medium risk' },
  HIGH:   { cls: 'badge-danger',  label: 'High risk'   },
}

const RELATIONS = ['FRIEND', 'FAMILY', 'COLLEAGUE', 'ROOMMATE', 'OTHER']
const AVATAR_COLORS = ['#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#EC4899']

export default function FriendsPage() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Friend | null>(null)
  const qc = useQueryClient()

  const { data: friends = [], isLoading } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: async () => (await friendsApi.list()).data,
  })

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      name: '', phone: '', whatsapp: '', relation: 'FRIEND', avatar_color: '#7C3AED',
    },
  })

  const createFriend = useMutation({
    mutationFn: (data: unknown) => friendsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      toast.success('Friend added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add friend'),
  })

  const deleteFriend = useMutation({
    mutationFn: (id: string) => friendsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      setSelected(null)
      toast.success('Friend removed')
    },
  })

  const totalPending = friends.reduce((s, f) => s + Number(f.total_pending), 0)
  const totalCollected = friends.reduce((s, f) => s + Number(f.total_collected), 0)
  const activeCount = friends.filter((f) => f.active_emi_count > 0).length
  const watchColor = watch('avatar_color')

  return (
    <AppShell>
      <PageHeader
          icon={Users}
          title="Friend EMIs"
          subtitle={`${friends.length} contacts`}
          actions={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Friend
            </button>
          }
        />
      <div className="p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Pending"   value={formatCurrencyCompact(totalPending)}   variant={totalPending > 0 ? 'warning' : 'default'} delay={0}    />
          <StatCard title="Total Collected" value={formatCurrencyCompact(totalCollected)} variant="success" delay={0.05} />
          <StatCard title="Active Friends"  value={String(activeCount)}                   variant="violet"  delay={0.1}  />
          <StatCard title="Total Friends"   value={String(friends.length)}                delay={0.15} />
        </div>

        {/* Friends grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-[#FFF1E6] shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : friends.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((friend, i) => {
              const riskCfg = RISK_CFG[friend.risk_level as keyof typeof RISK_CFG] ?? RISK_CFG.LOW
              const collectedPct = friend.total_emi_amount > 0
                ? Math.round((friend.total_collected / friend.total_emi_amount) * 100)
                : 0
              return (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(friend)}
                  className="card p-5 cursor-pointer hover:border-orange-200 transition-all"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                      style={{ background: friend.avatar_color ?? '#7C3AED' }}>
                      {friend.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{friend.name}</div>
                      <div className="text-xs text-muted-foreground">{friend.relation}</div>
                    </div>
                    <span className={riskCfg.cls}>{riskCfg.label}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-2.5 rounded-xl bg-[#FFF8F2]">
                      <div className="text-xs text-muted-foreground mb-0.5">Pending</div>
                      <div className="text-sm font-bold font-mono text-amber-400">{formatCurrencyCompact(Number(friend.total_pending))}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FFF8F2]">
                      <div className="text-xs text-muted-foreground mb-0.5">Collected</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrencyCompact(Number(friend.total_collected))}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{friend.active_emi_count} active EMIs</span>
                      <span>{collectedPct}% collected</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${collectedPct}%`, background: '#10B981' }} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1E6] flex items-center justify-center">
              <Users className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No friends added yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Friend
            </button>
          </div>
        )}

        {/* Friend detail modal */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white"
                      style={{ background: selected.avatar_color ?? '#7C3AED' }}>
                      {selected.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">{selected.name}</div>
                      <div className="text-xs text-muted-foreground">{selected.relation}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Total EMI Amount', formatCurrency(Number(selected.total_emi_amount))],
                    ['Collected', formatCurrency(Number(selected.total_collected))],
                    ['Pending', formatCurrency(Number(selected.total_pending))],
                    ['Active EMIs', String(selected.active_emi_count)],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{value}</div>
                    </div>
                  ))}
                </div>

                {selected.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
                    <Phone className="w-4 h-4" />
                    <span>{selected.phone}</span>
                  </div>
                )}

                <button
                  onClick={() => deleteFriend.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Friend
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add friend modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Add Friend</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <form onSubmit={handleSubmit((d) => createFriend.mutate(d))} className="space-y-4">
                  <div>
                    <label className="field-label">Full Name *</label>
                    <input {...register('name', { required: true })} placeholder="Rahul Sharma" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Phone</label>
                      <input {...register('phone')} placeholder="9876543210" />
                    </div>
                    <div>
                      <label className="field-label">Relation</label>
                      <select {...register('relation')}>
                        {RELATIONS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Avatar Color</label>
                    <div className="flex gap-2 mt-1">
                      {AVATAR_COLORS.map((c) => (
                        <button key={c} type="button"
                          onClick={() => reset({ ...watch(), avatar_color: c })}
                          className="w-8 h-8 rounded-xl transition-transform hover:scale-110"
                          style={{ background: c, outline: watchColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={createFriend.isPending} className="btn-primary w-full justify-center py-2.5">
                    {createFriend.isPending ? 'Adding…' : 'Add Friend'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
