'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { netWorthApi, bankAccountsApi, investmentsApi, loansApi, assetsApi } from '@/lib/api'
import { NetWorthData, NetWorthHistoryPoint } from '@/types'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { TrendingUp, TrendingDown, Landmark, BarChart3, Building2, CreditCard, Wallet, Camera } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { toast } from '@/components/ui/Toast'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format, parseISO } from 'date-fns'

const ASSET_COLOR = '#10B981'
const LIABILITY_COLOR = '#F97316'
const NW_COLOR = '#7C3AED'

function NetWorthChart({ data }: { data: NetWorthHistoryPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
      Take your first snapshot to start tracking history
    </div>
  )
  const formatted = data.map(d => ({
    ...d,
    label: format(parseISO(d.date), 'dd MMM'),
  }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={NW_COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={NW_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ASSET_COLOR} stopOpacity={0.18} />
            <stop offset="95%" stopColor={ASSET_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE4" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#A09890' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#A09890' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrencyCompact(value), name === 'net_worth' ? 'Net Worth' : name === 'total_assets' ? 'Assets' : 'Liabilities']}
          contentStyle={{ background: '#FFFAF7', border: '1px solid #E7E2DC', borderRadius: 12, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="total_assets" stroke={ASSET_COLOR} fill="url(#assetGrad)" strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="net_worth" stroke={NW_COLOR} fill="url(#nwGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface AllocationRowProps {
  label: string
  amount: number
  total: number
  color: string
  icon: React.ElementType
  onClick?: () => void
}

function AllocationRow({ label, amount, total, color, icon: Icon, onClick }: AllocationRowProps) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl hover:bg-[#FFF8F4] transition-colors ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-xs font-mono font-bold text-foreground">{formatCurrencyCompact(amount)}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

export function NetWorthView() {
  const qc = useQueryClient()
  const setView = useUIStore(s => s.setView)

  const { data: nw, isLoading } = useQuery<NetWorthData>({
    queryKey: ['net-worth'],
    queryFn: async () => (await netWorthApi.current()).data,
  })

  const { data: history = [] } = useQuery<NetWorthHistoryPoint[]>({
    queryKey: ['net-worth-history'],
    queryFn: async () => (await netWorthApi.history(12)).data,
  })

  const snapshot = useMutation({
    mutationFn: () => netWorthApi.snapshot(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      qc.invalidateQueries({ queryKey: ['net-worth-history'] })
      toast.success('Snapshot saved', 'Net worth recorded for tracking')
    },
    onError: () => toast.error('Snapshot failed'),
  })

  const nwValue = nw?.net_worth ?? 0
  const isPositive = nwValue >= 0
  const changeAmt = nw?.change_amount ?? 0
  const changePct = nw?.change_pct ?? 0
  const totalAssets = nw?.total_assets ?? 0
  const totalLiabilities = nw?.total_liabilities ?? 0

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title="Net Worth"
        subtitle="Complete financial picture"
        actions={
          <button
            onClick={() => snapshot.mutate()}
            disabled={snapshot.isPending}
            className="btn-primary"
          >
            <Camera className="w-4 h-4" />
            {snapshot.isPending ? 'Saving…' : 'Snapshot'}
          </button>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto space-y-6">

        {/* Net Worth Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
          style={{ background: 'linear-gradient(135deg, #FFFAF7 0%, #FFF3E8 100%)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Net Worth</p>
              <p className="text-4xl font-extrabold font-mono" style={{ color: isPositive ? '#7C3AED' : '#DC2626', letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}>
                {formatCurrency(nwValue)}
              </p>
              {nw && (
                <div className={`flex items-center gap-1.5 mt-2 text-sm font-semibold ${changeAmt >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {changeAmt >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{changeAmt >= 0 ? '+' : ''}{formatCurrencyCompact(changeAmt)}</span>
                  <span className="text-muted-foreground font-normal">({Math.abs(changePct).toFixed(1)}% since last snapshot)</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 rounded-xl text-center" style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Assets</p>
                <p className="text-lg font-bold font-mono text-emerald-600">{formatCurrencyCompact(totalAssets)}</p>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1">Liabilities</p>
                <p className="text-lg font-bold font-mono text-orange-600">{formatCurrencyCompact(totalLiabilities)}</p>
              </div>
            </div>
          </div>

          <NetWorthChart data={history} />
        </motion.div>

        {/* Asset & Liability Allocation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Assets breakdown */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              Assets Breakdown
            </h3>
            <div className="space-y-1">
              <AllocationRow label="Bank & Cash" amount={nw?.bank_balance ?? 0} total={totalAssets} color="#0EA5E9" icon={Landmark} onClick={() => setView('banking')} />
              <AllocationRow label="Investments" amount={nw?.investment_value ?? 0} total={totalAssets} color="#7C3AED" icon={BarChart3} onClick={() => setView('investments')} />
              <AllocationRow label="Physical Assets" amount={nw?.asset_value ?? 0} total={totalAssets} color="#10B981" icon={Building2} onClick={() => setView('assets')} />
            </div>
          </motion.div>

          {/* Liabilities breakdown */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-orange-600" />
              </div>
              Liabilities Breakdown
            </h3>
            <div className="space-y-1">
              <AllocationRow label="Credit Cards" amount={nw?.credit_card_outstanding ?? 0} total={totalLiabilities || 1} color="#F97316" icon={CreditCard} onClick={() => setView('cards')} />
              <AllocationRow label="Loans & EMIs" amount={nw?.loan_outstanding ?? 0} total={totalLiabilities || 1} color="#DC2626" icon={Wallet} onClick={() => setView('loans')} />
            </div>
          </motion.div>
        </div>

        {/* Investment P&L highlight */}
        {nw && nw.total_invested > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="card p-5 cursor-pointer" onClick={() => setView('investments')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #F3E8FF, #DDD6FE)', border: '1.5px solid #C4B5FD' }}>
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Investment Portfolio</p>
                  <p className="text-xs text-muted-foreground">
                    Invested {formatCurrencyCompact(nw.total_invested)} · Current {formatCurrencyCompact(nw.investment_value)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold font-mono ${nw.investment_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {nw.investment_pnl >= 0 ? '+' : ''}{formatCurrencyCompact(nw.investment_pnl)}
                </p>
                <p className={`text-xs font-semibold ${nw.investment_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {nw.total_invested > 0 ? `${((nw.investment_pnl / nw.total_invested) * 100).toFixed(1)}% returns` : ''}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Nav Grid */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Quick Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { view: 'banking', label: 'Banking', icon: Landmark, color: '#0EA5E9', bg: '#EFF6FF' },
              { view: 'investments', label: 'Investments', icon: BarChart3, color: '#7C3AED', bg: '#F3E8FF' },
              { view: 'loans', label: 'Loans', icon: Wallet, color: '#DC2626', bg: '#FEF2F2' },
              { view: 'assets', label: 'Assets', icon: Building2, color: '#10B981', bg: '#F0FDF4' },
            ].map(({ view, label, icon: Icon, color, bg }) => (
              <button key={view} onClick={() => setView(view as Parameters<typeof setView>[0])}
                className="card p-4 flex flex-col items-center gap-2 hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg, border: `1.5px solid ${color}30` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-xs font-semibold text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}
