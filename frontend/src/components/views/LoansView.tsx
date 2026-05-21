'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { loansApi } from '@/lib/api'
import { Loan } from '@/types'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Wallet, Plus, X, Trash2, Home, Car, GraduationCap, Briefcase, AlertCircle } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const LOAN_TYPES = [
  { value: 'HOME', label: '🏠 Home Loan' },
  { value: 'PERSONAL', label: '💼 Personal Loan' },
  { value: 'VEHICLE', label: '🚗 Vehicle Loan' },
  { value: 'EDUCATION', label: '🎓 Education Loan' },
  { value: 'GOLD', label: '🥇 Gold Loan' },
  { value: 'BUSINESS', label: '🏢 Business Loan' },
  { value: 'BNPL', label: '🛒 BNPL' },
  { value: 'INFORMAL', label: '🤝 Informal' },
  { value: 'OTHER', label: '📋 Other' },
]

const TYPE_EMOJI: Record<string, string> = {
  HOME: '🏠', PERSONAL: '💼', VEHICLE: '🚗', EDUCATION: '🎓',
  GOLD: '🥇', BUSINESS: '🏢', BNPL: '🛒', INFORMAL: '🤝', OTHER: '📋',
}

const STATUS_CFG = {
  ACTIVE:     { cls: 'badge-info',    label: 'Active' },
  CLOSED:     { cls: 'badge-success', label: 'Closed' },
  OVERDUE:    { cls: 'badge-danger',  label: 'Overdue' },
  WRITTEN_OFF: { cls: 'badge-neutral', label: 'Written Off' },
}

export function LoansView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Loan | null>(null)
  const qc = useQueryClient()

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: async () => (await loansApi.list()).data,
  })

  const { data: summary } = useQuery<{
    total_outstanding: number
    total_monthly_emi: number
    total_principal: number
    total_paid: number
    active_count: number
  }>({
    queryKey: ['loans-summary'],
    queryFn: async () => (await loansApi.summary()).data,
  })

  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: {
      loan_type: 'PERSONAL', lender_name: '', nickname: '',
      principal_amount: 0, outstanding_balance: 0, emi_amount: 0,
      interest_rate: 0, tenure_months: 0, remaining_months: 0,
      start_date: '', emi_due_day: 5, status: 'ACTIVE',
    },
  })

  const createLoan = useMutation({
    mutationFn: (data: unknown) => loansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans-summary'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      toast.success('Loan added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add loan'),
  })

  const deleteLoan = useMutation({
    mutationFn: (id: string) => loansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans-summary'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      setSelected(null)
      toast.success('Loan removed')
    },
  })

  const paidPct = (summary?.total_principal ?? 0) > 0
    ? Math.round(((summary?.total_paid ?? 0) / (summary?.total_principal ?? 1)) * 100)
    : 0

  return (
    <>
      <PageHeader
        icon={Wallet}
        title="Loans & Debt"
        subtitle={`${loans.length} loan${loans.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Loan
          </button>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Outstanding" value={formatCurrencyCompact(summary?.total_outstanding ?? 0)} icon={AlertCircle} variant="danger" delay={0} />
          <StatCard title="Monthly EMI" value={formatCurrencyCompact(summary?.total_monthly_emi ?? 0)} icon={Wallet} variant="warning" delay={0.05} />
          <StatCard title="Total Paid" value={formatCurrencyCompact(summary?.total_paid ?? 0)} icon={Briefcase} variant="success" delay={0.1} />
          <StatCard title="Progress" value={`${paidPct}%`} icon={GraduationCap} delay={0.15} />
        </div>

        {/* Loans List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-[#FFF1E6] shimmer" />)}
          </div>
        ) : loans.length ? (
          <div className="card overflow-hidden">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Loan</th>
                    <th>Lender</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">EMI</th>
                    <th>Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => {
                    const cfg = STATUS_CFG[loan.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.ACTIVE
                    const repaidPct = Number(loan.principal_amount) > 0
                      ? Math.round((Number(loan.total_paid) / Number(loan.principal_amount)) * 100)
                      : 0
                    return (
                      <tr key={loan.id} onClick={() => setSelected(loan)} className="cursor-pointer">
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{TYPE_EMOJI[loan.loan_type] ?? '📋'}</span>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{loan.nickname ?? loan.loan_type}</div>
                              <div className="progress-track mt-1" style={{ width: 80 }}>
                                <div className="progress-fill" style={{ width: `${repaidPct}%`, background: '#10B981' }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-muted-foreground">{loan.lender_name}</td>
                        <td className="text-right font-mono text-sm font-bold text-rose-500">{formatCurrencyCompact(Number(loan.outstanding_balance))}</td>
                        <td className="text-right font-mono text-sm">{loan.emi_amount ? formatCurrencyCompact(Number(loan.emi_amount)) : '—'}</td>
                        <td className="text-sm text-muted-foreground">{Number(loan.interest_rate).toFixed(2)}%</td>
                        <td><span className={cfg.cls}>{cfg.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', border: '2px solid #FECACA' }}>
              <Wallet className="w-7 h-7 text-rose-500" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No loans tracked</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Track home, personal & vehicle loans</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Loan
            </button>
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }} onClick={() => setSelected(null)}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-lg font-bold text-foreground">{TYPE_EMOJI[selected.loan_type]} {selected.nickname ?? selected.loan_type}</div>
                    <div className="text-xs text-muted-foreground">{selected.lender_name}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Principal', formatCurrency(Number(selected.principal_amount))],
                    ['Outstanding', formatCurrency(Number(selected.outstanding_balance))],
                    ['EMI', selected.emi_amount ? formatCurrency(Number(selected.emi_amount)) : '—'],
                    ['Rate', `${Number(selected.interest_rate).toFixed(2)}% p.a.`],
                    ['Tenure', selected.tenure_months ? `${selected.tenure_months} months` : '—'],
                    ['Remaining', selected.remaining_months ? `${selected.remaining_months} months` : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => deleteLoan.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Loan
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
              style={{ background: 'rgba(24,18,14,0.55)' }} onClick={() => setShowForm(false)}>
              <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Add Loan</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>
                <form onSubmit={handleSubmit(d => createLoan.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Loan Type</label>
                      <Controller name="loan_type" control={control} render={({ field }) => (
                        <Select value={field.value} onChange={field.onChange} options={LOAN_TYPES} />
                      )} />
                    </div>
                    <div>
                      <label className="field-label">Nickname</label>
                      <input {...register('nickname')} placeholder="My Home Loan" />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Lender Name *</label>
                    <input {...register('lender_name', { required: true })} placeholder="HDFC Bank" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Principal Amount (₹)</label>
                      <input type="number" {...register('principal_amount', { valueAsNumber: true })} placeholder="5000000" />
                    </div>
                    <div>
                      <label className="field-label">Outstanding Balance (₹)</label>
                      <input type="number" {...register('outstanding_balance', { valueAsNumber: true })} placeholder="4500000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">EMI Amount (₹)</label>
                      <input type="number" {...register('emi_amount', { valueAsNumber: true })} placeholder="45000" />
                    </div>
                    <div>
                      <label className="field-label">Interest Rate % p.a.</label>
                      <input type="number" step="0.01" {...register('interest_rate', { valueAsNumber: true })} placeholder="8.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Start Date</label>
                      <input type="date" {...register('start_date', { required: true })} />
                    </div>
                    <div>
                      <label className="field-label">Remaining Months</label>
                      <input type="number" {...register('remaining_months', { valueAsNumber: true })} placeholder="240" />
                    </div>
                  </div>
                  <button type="submit" disabled={createLoan.isPending} className="btn-primary w-full justify-center py-2.5">
                    {createLoan.isPending ? 'Adding…' : 'Add Loan'}
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
