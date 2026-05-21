'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { assetsApi } from '@/lib/api'
import { Asset } from '@/types'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { Building2, Plus, X, Trash2, Home, Car, Gem, Monitor, Package } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/ui/Select'

const ASSET_TYPES = [
  { value: 'REAL_ESTATE', label: '🏠 Real Estate' },
  { value: 'VEHICLE', label: '🚗 Vehicle' },
  { value: 'JEWELRY', label: '💎 Jewelry' },
  { value: 'ELECTRONICS', label: '💻 Electronics' },
  { value: 'FURNITURE', label: '🪑 Furniture' },
  { value: 'ARTWORK', label: '🎨 Artwork' },
  { value: 'OTHER', label: '📦 Other' },
]

const TYPE_EMOJI: Record<string, string> = {
  REAL_ESTATE: '🏠', VEHICLE: '🚗', JEWELRY: '💎',
  ELECTRONICS: '💻', FURNITURE: '🪑', ARTWORK: '🎨', OTHER: '📦',
}

const TYPE_COLOR: Record<string, string> = {
  REAL_ESTATE: '#10B981', VEHICLE: '#F97316', JEWELRY: '#F59E0B',
  ELECTRONICS: '#0EA5E9', FURNITURE: '#8B5CF6', ARTWORK: '#EC4899', OTHER: '#6B7280',
}

export function AssetsView() {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Asset | null>(null)
  const qc = useQueryClient()

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => (await assetsApi.list()).data,
  })

  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: {
      asset_type: 'REAL_ESTATE', name: '', description: '',
      purchase_price: 0, current_value: 0, purchase_date: '',
      depreciation_rate: 0, location: '', make_model: '',
      registration_number: '', year_of_manufacture: 0,
      is_insured: false, is_mortgaged: false, mortgage_outstanding: 0,
    },
  })

  const createAsset = useMutation({
    mutationFn: (data: unknown) => assetsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      toast.success('Asset added')
      setShowForm(false)
      reset()
    },
    onError: () => toast.error('Failed to add asset'),
  })

  const deleteAsset = useMutation({
    mutationFn: (id: string) => assetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['net-worth'] })
      setSelected(null)
      toast.success('Asset removed')
    },
  })

  const totalValue = assets.reduce((s, a) => s + Number(a.current_value), 0)
  const totalPurchased = assets.reduce((s, a) => s + Number(a.purchase_price ?? 0), 0)
  const appreciation = totalPurchased > 0 ? totalValue - totalPurchased : 0

  // Group by type
  const byType = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    if (!acc[a.asset_type]) acc[a.asset_type] = []
    acc[a.asset_type].push(a)
    return acc
  }, {})

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Assets"
        subtitle={`${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        }
      />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1200px] mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard title="Total Value" value={formatCurrencyCompact(totalValue)} icon={Building2} variant="success" delay={0} />
          <StatCard title="Cost Basis" value={formatCurrencyCompact(totalPurchased)} icon={Package} delay={0.05} />
          <StatCard title="Appreciation" value={`${appreciation >= 0 ? '+' : ''}${formatCurrencyCompact(appreciation)}`} icon={Home} variant={appreciation >= 0 ? 'success' : 'danger'} delay={0.1} />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-[#FFF1E6] shimmer" />)}
          </div>
        ) : assets.length ? (
          <div className="space-y-6">
            {Object.entries(byType).map(([type, items]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{TYPE_EMOJI[type]}</span>
                  <h3 className="text-sm font-bold text-foreground">{type.replace('_', ' ')}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((asset, i) => {
                    const color = TYPE_COLOR[asset.asset_type] ?? '#6B7280'
                    const purchaseAmt = Number(asset.purchase_price ?? 0)
                    const currentAmt = Number(asset.current_value)
                    const gain = purchaseAmt > 0 ? currentAmt - purchaseAmt : 0
                    return (
                      <motion.div
                        key={asset.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelected(asset)}
                        className="card p-4 cursor-pointer hover:border-orange-200 transition-all"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}>
                            {TYPE_EMOJI[asset.asset_type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{asset.name}</div>
                            {asset.location && <div className="text-xs text-muted-foreground truncate">{asset.location}</div>}
                            {asset.make_model && <div className="text-xs text-muted-foreground truncate">{asset.make_model}</div>}
                          </div>
                        </div>
                        <div className="text-xl font-bold font-mono text-foreground" style={{ letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>
                          {formatCurrencyCompact(currentAmt)}
                        </div>
                        {gain !== 0 && (
                          <div className={`text-xs font-semibold mt-0.5 ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {gain >= 0 ? '+' : ''}{formatCurrencyCompact(gain)} from purchase
                          </div>
                        )}
                        {asset.is_insured && (
                          <div className="mt-2 text-xs text-emerald-600 font-medium">✓ Insured</div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '2px solid #BBF7D0' }}>
              <Building2 className="w-7 h-7 text-emerald-600" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No assets tracked</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Track real estate, vehicles, jewelry & more</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Asset
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
                    <div className="text-lg font-bold text-foreground">{TYPE_EMOJI[selected.asset_type]} {selected.name}</div>
                    {selected.description && <div className="text-xs text-muted-foreground">{selected.description}</div>}
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    ['Current Value', formatCurrency(Number(selected.current_value))],
                    ['Purchase Price', selected.purchase_price ? formatCurrency(Number(selected.purchase_price)) : '—'],
                    ['Purchase Date', selected.purchase_date ? formatDate(selected.purchase_date, 'dd MMM yyyy') : '—'],
                    ['Depreciation', `${selected.depreciation_rate}% p.a.`],
                    ...(selected.location ? [['Location', selected.location]] : []),
                    ...(selected.make_model ? [['Model', selected.make_model]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-[#FFF8F2] border border-border/50">
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <div className="text-sm font-semibold text-foreground font-mono truncate">{value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => deleteAsset.mutate(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-rose-400 border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Asset
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
                  <h2 className="text-base font-bold text-foreground">Add Asset</h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-[#FFD9B0] active:scale-95" style={{ background: '#FFF1E6' }}>
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>
                <form onSubmit={handleSubmit(d => createAsset.mutate(d))} className="space-y-4">
                  <div>
                    <label className="field-label">Type</label>
                    <Controller name="asset_type" control={control} render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange} options={ASSET_TYPES} />
                    )} />
                  </div>
                  <div>
                    <label className="field-label">Asset Name *</label>
                    <input {...register('name', { required: true })} placeholder="3BHK Flat, Bangalore / Honda City 2020" />
                  </div>
                  <div>
                    <label className="field-label">Description</label>
                    <input {...register('description')} placeholder="Optional description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Current Value (₹) *</label>
                      <input type="number" {...register('current_value', { valueAsNumber: true, required: true })} placeholder="5000000" />
                    </div>
                    <div>
                      <label className="field-label">Purchase Price (₹)</label>
                      <input type="number" {...register('purchase_price', { valueAsNumber: true })} placeholder="4000000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Purchase Date</label>
                      <input type="date" {...register('purchase_date')} />
                    </div>
                    <div>
                      <label className="field-label">Depreciation % p.a.</label>
                      <input type="number" step="0.01" {...register('depreciation_rate', { valueAsNumber: true })} placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Location / Address</label>
                    <input {...register('location')} placeholder="Whitefield, Bangalore" />
                  </div>
                  <div>
                    <label className="field-label">Make/Model (for vehicles)</label>
                    <input {...register('make_model')} placeholder="Honda City ZX 2020" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF8F2] border border-border">
                    <input type="checkbox" id="is_insured" {...register('is_insured')} className="w-4 h-4 accent-orange-500" />
                    <label htmlFor="is_insured" className="text-sm font-medium text-foreground cursor-pointer">Asset is insured</label>
                  </div>
                  <button type="submit" disabled={createAsset.isPending} className="btn-primary w-full justify-center py-2.5">
                    {createAsset.isPending ? 'Adding…' : 'Add Asset'}
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
