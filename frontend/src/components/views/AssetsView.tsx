'use client'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { assetsApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, Info, Zap, ChevronRight, TrendingUp, TrendingDown,
  Shield, ShieldOff, Building2, Car, Gem, BarChart3, Package,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type {
  AssetIntelligence, AssetTypeBreakdown, AssetCard, LiquidityTier, AssetInsight,
} from '@/types'

const SEV = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', icon: Info,          iconBg: '#E0F2FE', iconColor: '#0284C7' },
}

// ─── Metric tile ──────────────────────────────────────────────────────────────
function MetricTile({
  label, value, sub, color = '#18120E', bg = '#FFF8F4', border = '#F0EAE4',
  icon: Icon, delay = 0,
}: {
  label: string; value: string; sub?: string; color?: string; bg?: string; border?: string
  icon: React.ElementType; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-xl p-4 border flex flex-col gap-1"
      style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <span className="text-xs font-medium text-amber-700">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-amber-600">{sub}</p>}
    </motion.div>
  )
}

// ─── Asset card ───────────────────────────────────────────────────────────────
function AssetCardItem({ asset }: { asset: AssetCard }) {
  const hasGain = asset.purchase_price > 0
  const gainPositive = asset.gain >= 0

  const typeIcon: Record<string, React.ElementType> = {
    REAL_ESTATE: Building2, VEHICLE: Car, JEWELRY: Gem,
  }
  const Icon = typeIcon[asset.type] || Building2

  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${asset.color}20` }}>
            <Icon size={15} style={{ color: asset.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">{asset.name}</p>
            <p className="text-xs text-amber-600">{asset.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {asset.is_insured
            ? <Shield size={13} className="text-emerald-500" />
            : <ShieldOff size={13} className="text-red-400" />}
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
            asset.liquidity === 'Illiquid'    ? 'bg-red-100 text-red-700' :
            asset.liquidity === 'Semi-liquid' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600')}>
            {asset.liquidity}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-amber-500 mb-0.5">Current Value</p>
          <p className="text-xl font-bold text-amber-900">{formatCurrencyCompact(asset.current_value)}</p>
        </div>
        {hasGain && (
          <div className="text-right">
            <div className={cn('flex items-center gap-1 text-sm font-bold',
              gainPositive ? 'text-emerald-600' : 'text-red-500')}>
              {gainPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {gainPositive ? '+' : ''}{formatCurrencyCompact(asset.gain)}
            </div>
            {asset.cagr !== 0 && (
              <p className="text-xs text-amber-500">{asset.cagr > 0 ? '+' : ''}{asset.cagr}% CAGR</p>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-500">
        {asset.purchase_date && <span>Bought: {asset.purchase_date}</span>}
        {asset.location       && <span>📍 {asset.location}</span>}
        {asset.area_sqft > 0  && <span>{asset.area_sqft.toLocaleString()} sqft</span>}
        {asset.make_model     && <span>{asset.make_model}</span>}
        {asset.year_of_manufacture && <span>Year: {asset.year_of_manufacture}</span>}
        {asset.depreciation_rate > 0 && <span className="text-red-400">Depr: {asset.depreciation_rate}%/yr</span>}
      </div>

      {/* Mortgage badge */}
      {asset.is_mortgaged && asset.mortgage_outstanding > 0 && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-100">
          Mortgage: {formatCurrencyCompact(asset.mortgage_outstanding)} outstanding
        </div>
      )}

      {/* Insurance expiry warning */}
      {asset.is_insured && asset.ins_expiry_days != null && asset.ins_expiry_days <= 60 && (
        <div className={cn('mt-2 text-xs rounded px-2 py-1 border',
          asset.ins_expiry_days <= 0
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200')}>
          Insurance {asset.ins_expiry_days <= 0 ? 'EXPIRED' : `expires in ${asset.ins_expiry_days}d`}
        </div>
      )}
    </div>
  )
}

// ─── Allocation row ───────────────────────────────────────────────────────────
function AllocRow({ t }: { t: AssetTypeBreakdown }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
      <span className="text-sm text-amber-900 flex-1 truncate">{t.label}</span>
      <span className="text-xs font-semibold text-amber-700">{t.pct}%</span>
      <span className="text-xs text-amber-600 w-20 text-right">{formatCurrencyCompact(t.value)}</span>
    </div>
  )
}

const EMPTY: AssetIntelligence = {
  total_value: 0, free_value: 0, mortgaged_value: 0,
  insured_value: 0, uninsured_value: 0,
  purchase_total: 0, appreciation: 0, asset_count: 0,
  by_type: [], liquidity_breakdown: [], asset_cards: [], insights: [],
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AssetsView() {
  const setView = useUIStore(s => s.setView)

  const { data: intel = EMPTY } = useQuery<AssetIntelligence>({
    queryKey: ['asset-intelligence'],
    queryFn: () => assetsApi.intelligence().then(r => r.data),
  })

  const NAV: Record<string, ViewId> = {
    'net-worth': 'net-worth', banking: 'banking', investments: 'investments',
    assets: 'assets', loans: 'loans', cards: 'cards',
  }

  const appreciationPos = intel.appreciation >= 0
  const appreciationPct = intel.purchase_total > 0
    ? (intel.appreciation / intel.purchase_total * 100) : 0

  return (
    <div className="space-y-6 pb-10 p-3 sm:p-5 xl:p-6 max-w-[1440px] mx-auto">
      <PageHeader icon={Package} title="Asset Intelligence" subtitle="Physical & non-traditional wealth management" />

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1A0F0A 0%, #2D1810 50%, #1A2E1A 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-64 h-64 rounded-full opacity-10"
               style={{ background: '#3B82F6', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full opacity-10"
               style={{ background: '#D97706', filter: 'blur(60px)' }} />
        </div>
        <div className="relative p-6 flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex-1">
            <p className="text-blue-400 text-sm font-medium mb-1">Total Asset Value</p>
            <p className="text-4xl font-black text-white">{formatCurrencyCompact(intel.total_value)}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm">
              <span className="text-emerald-300">Free: {formatCurrencyCompact(intel.free_value)}</span>
              <span className="text-red-300">Mortgaged: {formatCurrencyCompact(intel.mortgaged_value)}</span>
              {intel.purchase_total > 0 && (
                <span className={cn('flex items-center gap-1 font-bold px-2 py-0.5 rounded-full',
                  appreciationPos ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300')}>
                  {appreciationPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {appreciationPos ? '+' : ''}{formatCurrencyCompact(intel.appreciation)} ({appreciationPct.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-amber-500 flex-wrap">
              <span>Insured: {formatCurrencyCompact(intel.insured_value)}</span>
              <span className={intel.uninsured_value > 100000 ? 'text-red-400' : ''}>
                Uninsured: {formatCurrencyCompact(intel.uninsured_value)}
              </span>
              <span>{intel.asset_count} assets</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Metric tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile delay={0.05} label="Free Value"     value={formatCurrencyCompact(intel.free_value)}      icon={Building2} />
        <MetricTile delay={0.10} label="Appreciation"
          value={formatCurrencyCompact(Math.abs(intel.appreciation))}
          sub={`${appreciationPct.toFixed(1)}% overall`}
          icon={appreciationPos ? TrendingUp : TrendingDown}
          bg={appreciationPos ? '#F0FDF4' : '#FEF2F2'} border={appreciationPos ? '#BBF7D0' : '#FECACA'}
          color={appreciationPos ? '#166534' : '#991B1B'} />
        <MetricTile delay={0.15} label="Insured Value"  value={formatCurrencyCompact(intel.insured_value)}   icon={Shield}     bg="#F0FDF4" border="#BBF7D0" color="#166534" />
        <MetricTile delay={0.20} label="Uninsured"      value={formatCurrencyCompact(intel.uninsured_value)} icon={ShieldOff}  bg="#FEF2F2" border="#FECACA" color="#991B1B" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Asset allocation donut */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-600">◉</span>
            <h3 className="text-sm font-semibold text-amber-900">Asset Allocation</h3>
          </div>
          {intel.by_type.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={intel.by_type} dataKey="value" cx="50%" cy="50%"
                       innerRadius={38} outerRadius={62} paddingAngle={2}>
                    {intel.by_type.map((t, i) => <Cell key={i} fill={t.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {intel.by_type.map((t, i) => <AllocRow key={i} t={t} />)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">Add assets to see allocation</p>
          )}
        </div>

        {/* Liquidity breakdown */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Liquidity Breakdown</h3>
          </div>
          {intel.liquidity_breakdown.length > 0 ? (
            <div className="space-y-3 mt-2">
              {intel.liquidity_breakdown.map((tier, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-700 font-medium">{tier.tier}</span>
                    <span className="text-amber-600">{formatCurrencyCompact(tier.value)} ({tier.pct}%)</span>
                  </div>
                  <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${tier.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i }}
                      style={{ background: tier.color }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-amber-500 mt-2">
                💡 Illiquid assets cannot be quickly converted to cash in emergencies
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-500 text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      {/* ── Asset cards ── */}
      {intel.asset_cards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-900 mb-3">Your Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intel.asset_cards.map(asset => <AssetCardItem key={asset.id} asset={asset} />)}
          </div>
        </div>
      )}

      {/* ── AI Insights ── */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Asset Intelligence</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {intel.insights.map((ins, i) => {
              const cfg = SEV[ins.severity]
              const Icon = cfg.icon
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="rounded-xl p-4 border cursor-pointer hover:brightness-95 transition-all"
                  style={{ background: cfg.bg, borderColor: cfg.border }}
                  onClick={() => ins.action && NAV[ins.action] && setView(NAV[ins.action] as ViewId)}>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.iconBg }}>
                      <Icon size={14} style={{ color: cfg.iconColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{ins.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ins.body}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Net Worth link ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="rounded-xl border border-amber-200 bg-gradient-to-r from-blue-50 to-amber-50 p-4 flex items-center justify-between cursor-pointer hover:brightness-95 transition-all"
        onClick={() => setView('net-worth')}>
        <div>
          <p className="text-sm font-semibold text-amber-900">View in Net Worth Engine</p>
          <p className="text-xs text-amber-600 mt-0.5">See how physical assets contribute to your total wealth</p>
        </div>
        <ChevronRight size={18} className="text-amber-500" />
      </motion.div>
    </div>
  )
}
