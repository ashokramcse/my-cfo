'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { bankAccountsApi } from '@/lib/api'
import { BankAccount } from '@/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Landmark, Plus, X, Trash2, Star, Wallet, PiggyBank, CreditCard } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const ACCOUNT_TYPES = [
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CURRENT', label: 'Current' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'FD', label: 'Fixed Deposit' },
  { value: 'RD', label: 'Recurring Deposit' },
]

const ACCOUNT_COLORS = ['#0EA5E9', '#10B981', '#F97316', '#7C3AED', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1']

const TYPE_ICON = {
  SAVINGS: PiggyBank, CURRENT: Landmark, SALARY: Wallet, WALLET: Wallet,
  UPI: Wallet, CASH: Wallet, FD: Star, RD: Star,
}

const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Federal', 'IDFC', 'AU', 'Paytm', 'PhonePe', 'GPay', 'Cash', 'Other']

export function BankingView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<BankAccount | null>(null)
  const qc = useQueryClient()

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => (await bankAccountsApi.list()).data,
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
      qc.invalidateQueries({ queryKey: ['net-worth'] })
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
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      setSelected(null)
      toast.success('Account removed')
    },
  })

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0)
  const primaryAcc = accounts.find(a => a.is_primary)
  const activeCount = accounts.filter(a => a.is_active).length
  const watchColor = watch('account_color')

  return (
    <>
      <PageHeader
        icon={Landmark}
        title="Banking"
        subtitle={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Balance" value={formatCurrencyCompact(totalBalance)} icon={Landmark} variant="info" delay={0} />
          <StatCard title="Accounts" value={String(activeCount)} icon={Wallet} delay={0.05} />
          <StatCard title="Primary Balance" value={primaryAcc ? formatCurrencyCompact(Number(primaryAcc.current_balance)) : '—'} icon={Star} variant="success" delay={0.1} />
          <StatCard title="FD / RD" value={String(accounts.filter(a => a.account_type === 'FD' || a.account_type === 'RD').length)} icon={PiggyBank} delay={0.15} />
        </div>

        {/* Accounts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-[#FFF1E6] shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : accounts.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc, i) => {
              const Icon = TYPE_ICON[acc.account_type as keyof typeof TYPE_ICON] ?? Landmark
              return (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(acc)}
                  className="card p-5 cursor-pointer hover:border-orange-200 transition-all"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${acc.account_color}20`, border: `1.5px solid ${acc.account_color}50` }}>
                      <Icon className="w-5 h-5" style={{ color: acc.account_color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-semibold text-foreground truncate">{acc.nickname}</div>
                        {acc.is_primary && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{acc.bank_name} · {acc.account_type}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-foreground" style={{ letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>
                    {formatCurrencyCompact(Number(acc.current_balance))}
                  </div>
                  {acc.account_number_last4 && (
                    <div className="text-xs text-muted-foreground mt-1">···· {acc.account_number_last4}</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '2px solid #BFDBFE' }}>
              <Landmark className="w-7 h-7 text-blue-500" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No accounts added yet</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Track your savings, wallets & FDs</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Account
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
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Balance', formatCurrency(Number(selected.current_balance))],
                    ['Min Balance', formatCurrency(Number(selected.minimum_balance))],
                    ['Interest Rate', `${selected.interest_rate}% p.a.`],
                    ['Account No.', selected.account_number_last4 ? `···· ${selected.account_number_last4}` : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{value}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => deleteAccount.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Account
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
                className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Add Bank Account</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
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
                  <button type="submit" disabled={createAccount.isPending} className="btn-primary w-full justify-center py-2.5">
                    {createAccount.isPending ? 'Adding…' : 'Add Account'}
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
