'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { insuranceApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Shield, ShieldOff, Plus, X, AlertTriangle, Info, Zap,
  ChevronRight, Calendar, Heart,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import { toast } from '@/components/ui/Toast'
import type { InsuranceIntelligence, PolicyCard } from '@/types'

const SEV = {
  CRITICAL: { bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  WARNING:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle, iconBg: '#FEF3C7', iconColor: '#D97706' },
  INFO:     { bg: '#F0F9FF', border: '#BAE6FD', icon: Info,          iconBg: '#E0F2FE', iconColor: '#0284C7' },
}

const INS_TYPES = ['HEALTH','TERM','LIFE','VEHICLE','TRAVEL','PROPERTY','OTHER']
const TYPE_LABELS: Record<string,string> = {
  HEALTH:'Health', TERM:'Term Life', LIFE:'Life Insurance',
  VEHICLE:'Vehicle', TRAVEL:'Travel', PROPERTY:'Property', OTHER:'Other',
}
const FREQ_OPTIONS = ['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY','SINGLE']
const FREQ_LABELS: Record<string,string> = {
  MONTHLY:'Monthly', QUARTERLY:'Quarterly', HALF_YEARLY:'Half-Yearly',
  YEARLY:'Yearly', SINGLE:'Single Premium',
}

function AddModal({ onClose, onSave }: { onClose: ()=>void; onSave: (d:any)=>void }) {
  const [f, setF] = useState({
    insurance_type: 'HEALTH', policy_name: '', insurer: '',
    policy_number: '', premium_amount: '', premium_frequency: 'YEARLY',
    sum_assured: '', cover_amount: '', renewal_date: '', beneficiary: '', notes: '',
  })
  const s = (k: string, v: any) => setF(p => ({...p,[k]:v}))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(24,18,14,0.6)' }}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-amber-100">
          <h2 className="font-bold text-amber-900">Add Insurance Policy</h2>
          <button onClick={onClose} className="text-amber-400 hover:text-amber-600"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          {[
            {label:'Type *', key:'insurance_type', type:'select', opts:INS_TYPES, optLabels:TYPE_LABELS},
            {label:'Policy Name *', key:'policy_name', ph:'HDFC Ergo Health Optima'},
            {label:'Insurer *', key:'insurer', ph:'HDFC Ergo / LIC / Star Health'},
            {label:'Policy Number', key:'policy_number', ph:'Optional'},
            {label:'Premium (₹) *', key:'premium_amount', type:'number', ph:'12000'},
            {label:'Premium Frequency', key:'premium_frequency', type:'select', opts:FREQ_OPTIONS, optLabels:FREQ_LABELS},
            {label:'Sum Assured / Cover (₹)', key:'sum_assured', type:'number', ph:'500000'},
            {label:'Cover Amount (₹)', key:'cover_amount', type:'number', ph:'For health: floater cover'},
            {label:'Renewal Date', key:'renewal_date', type:'date'},
            {label:'Nominee / Beneficiary', key:'beneficiary', ph:'Spouse, children'},
          ].map(({label, key, type='text', ph, opts, optLabels}) => (
            <div key={key}>
              <label className="text-xs font-medium text-amber-700 mb-1 block">{label}</label>
              {type === 'select' && opts ? (
                <select className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                  value={(f as any)[key]} onChange={e => s(key, e.target.value)}>
                  {opts.map(o => <option key={o} value={o}>{(optLabels as any)[o]}</option>)}
                </select>
              ) : (
                <input type={type} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                  placeholder={ph} value={(f as any)[key]} onChange={e => s(key, e.target.value)} />
              )}
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Notes</label>
            <textarea rows={2} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              value={f.notes} onChange={e => s('notes', e.target.value)} />
          </div>
        </div>
        <div className="p-5 border-t border-amber-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-amber-200 text-sm text-amber-700 hover:bg-amber-50">Cancel</button>
          <button onClick={() => {
            if (!f.policy_name || !f.insurer || !f.premium_amount) return
            onSave({
              insurance_type: f.insurance_type, policy_name: f.policy_name,
              insurer: f.insurer, policy_number: f.policy_number || undefined,
              premium_amount: parseFloat(f.premium_amount), premium_frequency: f.premium_frequency,
              sum_assured: f.sum_assured ? parseFloat(f.sum_assured) : undefined,
              cover_amount: f.cover_amount ? parseFloat(f.cover_amount) : undefined,
              renewal_date: f.renewal_date || undefined,
              beneficiary: f.beneficiary || undefined, notes: f.notes || undefined,
            })
          }} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background:'linear-gradient(135deg,#F97316,#EA580C)' }}>
            Add Policy
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function MetricTile({label, value, sub, color='#18120E', bg='#FFF8F4', border='#F0EAE4', icon:Icon, delay=0}:{
  label:string;value:string;sub?:string;color?:string;bg?:string;border?:string;icon:React.ElementType;delay?:number}) {
  return (
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay,duration:0.35}}
      className="rounded-xl p-4 border flex flex-col gap-1" style={{background:bg,borderColor:border}}>
      <div className="flex items-center gap-2"><Icon size={15} style={{color}}/><span className="text-xs font-medium text-amber-700">{label}</span></div>
      <p className="text-lg font-bold leading-tight" style={{color}}>{value}</p>
      {sub && <p className="text-xs text-amber-600">{sub}</p>}
    </motion.div>
  )
}

const EMPTY: InsuranceIntelligence = {
  total_annual_premium:0, total_monthly_premium:0, total_cover:0,
  total_sum_assured:0, policy_count:0, by_type:[], policy_cards:[], coverage_gaps:[], insights:[],
}

export function InsuranceView() {
  const setView = useUIStore(s => s.setView)
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: intel = EMPTY } = useQuery<InsuranceIntelligence>({
    queryKey: ['insurance-intelligence'],
    queryFn: () => insuranceApi.intelligence().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d:any) => insuranceApi.create(d),
    onSuccess: () => { qc.invalidateQueries({queryKey:['insurance-intelligence']}); setShowAdd(false); toast.success('Policy added') },
  })
  const deleteMut = useMutation({
    mutationFn: (id:string) => insuranceApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:['insurance-intelligence']}); toast.success('Policy removed') },
  })

  const NAV: Record<string,ViewId> = { insurance:'insurance', 'net-worth':'net-worth', assets:'assets' }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader icon={Shield} title="Insurance Management"
        subtitle="Coverage overview · renewals · protection gaps"
        actions={
          <button onClick={()=>setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
            <Plus size={15}/> Add Policy
          </button>
        }/>
      <AnimatePresence>{showAdd && <AddModal onClose={()=>setShowAdd(false)} onSave={d=>createMut.mutate(d)}/>}</AnimatePresence>

      {/* Coverage gap alert */}
      {intel.coverage_gaps.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-red-800">Coverage Gaps Detected</p>
            <p className="text-xs text-red-600 mt-0.5">Missing: {intel.coverage_gaps.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
        className="rounded-2xl overflow-hidden relative"
        style={{background:'linear-gradient(135deg,#1A0F0A 0%,#2D1810 50%,#1A1F2E 100%)'}}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full opacity-10"
               style={{background:'#EF4444',filter:'blur(80px)'}}/>
        </div>
        <div className="relative p-6">
          <p className="text-red-400 text-sm font-medium mb-1">Total Annual Premium</p>
          <p className="text-4xl font-black text-white">{formatCurrencyCompact(intel.total_annual_premium)}</p>
          <div className="flex gap-4 mt-2 text-sm flex-wrap">
            <span className="text-amber-300">{formatCurrencyCompact(intel.total_monthly_premium)}/mo</span>
            <span className="text-blue-300">Cover: {formatCurrencyCompact(intel.total_cover)}</span>
            <span className="text-emerald-300">{intel.policy_count} active policies</span>
          </div>
        </div>
      </motion.div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile delay={0.05} label="Monthly Premium" value={formatCurrencyCompact(intel.total_monthly_premium)} icon={Calendar}/>
        <MetricTile delay={0.10} label="Total Cover" value={formatCurrencyCompact(intel.total_cover)} icon={Shield} bg="#F0F9FF" border="#BAE6FD" color="#0284C7"/>
        <MetricTile delay={0.15} label="Sum Assured" value={formatCurrencyCompact(intel.total_sum_assured)} icon={Heart} bg="#F0FDF4" border="#BBF7D0" color="#166534"/>
        <MetricTile delay={0.20} label="Policies" value={`${intel.policy_count} active`} icon={Shield} bg="#F5F3FF" border="#DDD6FE" color="#5B21B6"/>
      </div>

      {/* Policy cards */}
      {intel.policy_cards.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-amber-900 mb-3">Your Policies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intel.policy_cards.map(p => {
              const urgent = p.days_to_renewal != null && p.days_to_renewal <= 30
              const expiring = p.days_to_renewal != null && p.days_to_renewal <= 60 && p.days_to_renewal > 30
              return (
                <div key={p.id} className={cn('rounded-xl border bg-white p-4',
                  urgent ? 'border-red-300' : expiring ? 'border-amber-300' : 'border-amber-200')}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-10 rounded-full flex-shrink-0" style={{background:p.color}}/>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">{p.policy_name}</p>
                        <p className="text-xs text-amber-600">{p.insurer} · {p.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.is_active
                        ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>
                        : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>}
                      <button onClick={() => deleteMut.mutate(p.id)}
                        className="text-amber-300 hover:text-red-400 p-1"><X size={13}/></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-amber-500">Premium</p>
                      <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(p.premium_amount)}</p>
                      <p className="text-[10px] text-amber-400">{FREQ_LABELS[p.premium_frequency] || p.premium_frequency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-500">Cover</p>
                      <p className="text-sm font-bold text-blue-700">{formatCurrencyCompact(p.cover_amount || p.sum_assured)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-500">Renewal</p>
                      {p.days_to_renewal != null ? (
                        <p className={cn('text-sm font-bold', urgent ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-emerald-700')}>
                          {p.days_to_renewal <= 0 ? 'EXPIRED' : `${p.days_to_renewal}d`}
                        </p>
                      ) : <p className="text-sm text-amber-400">—</p>}
                    </div>
                  </div>
                  {p.beneficiary && (
                    <p className="text-xs text-amber-500 mt-2">Nominee: {p.beneficiary}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 p-10 text-center">
          <Shield size={32} className="text-amber-300 mx-auto mb-3"/>
          <p className="text-amber-700 font-medium">No policies added yet</p>
          <p className="text-amber-500 text-sm mt-1">Add your health, term, and vehicle insurance</p>
        </div>
      )}

      {/* AI Insights */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600"/>
            <h3 className="text-sm font-semibold text-amber-900">Insurance Intelligence</h3>
          </div>
          <div className="space-y-3">
            {intel.insights.map((ins, i) => {
              const cfg = SEV[ins.severity]; const Icon = cfg.icon
              return (
                <motion.div key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                  transition={{delay:0.05*i}}
                  className="rounded-xl p-4 border cursor-pointer hover:brightness-95 transition-all"
                  style={{background:cfg.bg,borderColor:cfg.border}}
                  onClick={()=>ins.action && NAV[ins.action] && setView(NAV[ins.action] as ViewId)}>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{background:cfg.iconBg}}><Icon size={14} style={{color:cfg.iconColor}}/></div>
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
    </div>
  )
}
