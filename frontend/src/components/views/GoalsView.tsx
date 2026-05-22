'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { goalsApi } from '@/lib/api'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Target, Plus, X, AlertTriangle, Info, Zap,
  ChevronRight, CheckCircle2, Clock, TrendingUp,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { ViewId } from '@/store/ui'
import { toast } from '@/components/ui/Toast'
import type { GoalIntelligence, GoalCard } from '@/types'

const SEV = {
  CRITICAL: { bg:'#FEF2F2', border:'#FECACA', icon:AlertTriangle, iconBg:'#FEE2E2', iconColor:'#DC2626' },
  WARNING:  { bg:'#FFFBEB', border:'#FDE68A', icon:AlertTriangle, iconBg:'#FEF3C7', iconColor:'#D97706' },
  INFO:     { bg:'#F0F9FF', border:'#BAE6FD', icon:Info,          iconBg:'#E0F2FE', iconColor:'#0284C7' },
}

const GOAL_TYPES = ['EMERGENCY_FUND','RETIREMENT','HOUSE','CAR','EDUCATION',
                    'VACATION','DEBT_FREE','INVESTMENT','WEDDING','OTHER']
const TYPE_LABELS: Record<string,string> = {
  EMERGENCY_FUND:'Emergency Fund', RETIREMENT:'Retirement', HOUSE:'House Purchase',
  CAR:'Car Purchase', EDUCATION:'Education', VACATION:'Vacation',
  DEBT_FREE:'Debt Free', INVESTMENT:'Corpus Growth', WEDDING:'Wedding', OTHER:'Other',
}
const COLORS = ['#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#EC4899','#D97706','#06B6D4','#F472B6','#6B7280']

function AddGoalModal({onClose, onSave}:{onClose:()=>void;onSave:(d:any)=>void}) {
  const [f,setF] = useState({
    name:'', goal_type:'EMERGENCY_FUND', target_amount:'',
    current_amount:'0', monthly_contribution:'', target_date:'',
    priority:'MEDIUM', icon_color:'#F59E0B', notes:'',
  })
  const s = (k:string,v:any) => setF(p=>({...p,[k]:v}))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(24,18,14,0.6)'}}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-amber-100">
          <h2 className="font-bold text-amber-900">Add Financial Goal</h2>
          <button onClick={onClose} className="text-amber-400 hover:text-amber-600"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Goal Name *</label>
            <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Emergency Fund, Retirement Corpus"
              value={f.name} onChange={e=>s('name',e.target.value)}/>
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Goal Type *</label>
            <select className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
              value={f.goal_type} onChange={e=>s('goal_type',e.target.value)}>
              {GOAL_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-amber-700 mb-1 block">Target Amount (₹) *</label>
              <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                placeholder="1000000" value={f.target_amount} onChange={e=>s('target_amount',e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-medium text-amber-700 mb-1 block">Already Saved (₹)</label>
              <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                placeholder="0" value={f.current_amount} onChange={e=>s('current_amount',e.target.value)}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-amber-700 mb-1 block">Monthly Contribution (₹)</label>
              <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                placeholder="10000" value={f.monthly_contribution} onChange={e=>s('monthly_contribution',e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-medium text-amber-700 mb-1 block">Target Date</label>
              <input type="date" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm"
                value={f.target_date} onChange={e=>s('target_date',e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Priority</label>
            <div className="flex gap-2">
              {['HIGH','MEDIUM','LOW'].map(p=>(
                <button key={p} onClick={()=>s('priority',p)}
                  className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    f.priority===p ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-200 text-amber-700 hover:bg-amber-50')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-amber-700 mb-1 block">Goal Colour</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c=>(
                <button key={c} onClick={()=>s('icon_color',c)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all',
                    f.icon_color===c ? 'border-amber-800 scale-110' : 'border-transparent')}
                  style={{background:c}}/>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-amber-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-amber-200 text-sm text-amber-700 hover:bg-amber-50">Cancel</button>
          <button onClick={()=>{
            if(!f.name||!f.target_amount) return
            onSave({
              name:f.name, goal_type:f.goal_type,
              target_amount:parseFloat(f.target_amount),
              current_amount:parseFloat(f.current_amount||'0'),
              monthly_contribution:parseFloat(f.monthly_contribution||'0'),
              target_date:f.target_date||undefined,
              priority:f.priority, icon_color:f.icon_color,
            })
          }} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
            Create Goal
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function ContributeModal({goal, onClose, onSave}:{goal:GoalCard;onClose:()=>void;onSave:(amt:number)=>void}) {
  const [amt, setAmt] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(24,18,14,0.6)'}}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-amber-900">Add to {goal.name}</h2>
          <button onClick={onClose} className="text-amber-400"><X size={18}/></button>
        </div>
        <p className="text-sm text-amber-600 mb-4">
          Progress: {formatCurrencyCompact(goal.current)} / {formatCurrencyCompact(goal.target)} ({goal.pct_done}%)
        </p>
        <input type="number" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm mb-4"
          placeholder="Enter amount (₹)" value={amt} onChange={e=>setAmt(e.target.value)} autoFocus/>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-amber-200 text-sm text-amber-700">Cancel</button>
          <button onClick={()=>{if(amt)onSave(parseFloat(amt))}}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
            Add ₹{amt||'0'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const EMPTY: GoalIntelligence = {
  total_target:0, total_saved:0, overall_pct:0, total_monthly_req:0,
  active_count:0, achieved_count:0, goal_cards:[], insights:[],
  monthly_surplus: undefined, monthly_income: undefined,
}

export function GoalsView() {
  const setView = useUIStore(s => s.setView)
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [contributing, setContributing] = useState<GoalCard|null>(null)

  const { data: intel = EMPTY } = useQuery<GoalIntelligence>({
    queryKey: ['goal-intelligence'],
    queryFn: () => goalsApi.intelligence().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d:any) => goalsApi.create(d),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['goal-intelligence']}); setShowAdd(false); toast.success('Goal created!') },
  })
  const contributeMut = useMutation({
    mutationFn: ({id,amt}:{id:string;amt:number}) => goalsApi.contribute(id,amt),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['goal-intelligence']}); setContributing(null); toast.success('Contribution added!') },
  })
  const deleteMut = useMutation({
    mutationFn: (id:string) => goalsApi.delete(id),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['goal-intelligence']}); toast.success('Goal removed') },
  })

  const NAV: Record<string,ViewId> = { goals:'goals', banking:'banking', investments:'investments', 'net-worth':'net-worth' }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader icon={Target} title="Financial Goals"
        subtitle="Goal tracking · progress · projections"
        actions={
          <button onClick={()=>setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
            <Plus size={15}/> Add Goal
          </button>
        }/>
      <AnimatePresence>
        {showAdd && <AddGoalModal onClose={()=>setShowAdd(false)} onSave={d=>createMut.mutate(d)}/>}
        {contributing && (
          <ContributeModal goal={contributing} onClose={()=>setContributing(null)}
            onSave={amt=>contributeMut.mutate({id:contributing.id, amt})}/>
        )}
      </AnimatePresence>

      {/* Hero */}
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}
        className="rounded-2xl overflow-hidden relative"
        style={{background:'linear-gradient(135deg,#1A0F0A 0%,#2D1810 50%,#1F2E1A 100%)'}}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-64 h-64 rounded-full opacity-10"
               style={{background:'#F59E0B',filter:'blur(80px)'}}/>
        </div>
        <div className="relative p-6">
          <p className="text-amber-400 text-sm font-medium mb-1">Total Goal Progress</p>
          <p className="text-4xl font-black text-white">{intel.overall_pct}%</p>
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full bg-amber-500"
              initial={{width:0}} animate={{width:`${intel.overall_pct}%`}}
              transition={{duration:1, delay:0.5}}/>
          </div>
          <div className="flex gap-4 mt-3 text-sm flex-wrap">
            <span className="text-amber-300">{formatCurrencyCompact(intel.total_saved)} saved</span>
            <span className="text-amber-500">of {formatCurrencyCompact(intel.total_target)}</span>
            <span className="text-emerald-400">{intel.achieved_count} achieved 🎉</span>
          </div>
        </div>
      </motion.div>

      {/* Surplus conflict banner */}
      {intel.monthly_surplus !== undefined && intel.total_monthly_req > (intel.monthly_surplus ?? 0) && intel.total_monthly_req > 0 && (
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          className="rounded-xl p-4 border border-amber-300 bg-amber-50 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0"/>
          <p className="text-sm text-amber-800">
            ⚠️ Your total goal contributions ({formatCurrencyCompact(intel.total_monthly_req)}/mo) exceed your monthly surplus ({formatCurrencyCompact(intel.monthly_surplus ?? 0)}/mo). Consider adjusting.
          </p>
        </motion.div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {label:'Total Target', value:formatCurrencyCompact(intel.total_target), icon:Target, delay:0.05},
          {label:'Total Saved', value:formatCurrencyCompact(intel.total_saved), icon:TrendingUp, delay:0.10, bg:'#F0FDF4', border:'#BBF7D0', color:'#166534'},
          {label:'Monthly Required', value:formatCurrencyCompact(intel.total_monthly_req), icon:Clock, delay:0.15},
          ...(intel.monthly_surplus !== undefined
            ? [{label:'Monthly Surplus', value:formatCurrencyCompact(intel.monthly_surplus), icon:CheckCircle2, delay:0.20,
                bg: (intel.monthly_surplus ?? 0) >= 0 ? '#F0FDF4' : '#FEF2F2',
                border: (intel.monthly_surplus ?? 0) >= 0 ? '#BBF7D0' : '#FECACA',
                color: (intel.monthly_surplus ?? 0) >= 0 ? '#166534' : '#991B1B'}]
            : [{label:'Goals', value:`${intel.active_count} active`, icon:CheckCircle2, delay:0.20, bg:'#F5F3FF', border:'#DDD6FE', color:'#5B21B6'}]
          ),
        ].map(({label,value,icon:Icon,delay,bg='#FFF8F4',border='#F0EAE4',color='#18120E'})=>(
          <motion.div key={label} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}
            transition={{delay,duration:0.35}}
            className="rounded-xl p-4 border flex flex-col gap-1" style={{background:bg,borderColor:border}}>
            <div className="flex items-center gap-2"><Icon size={15} style={{color}}/><span className="text-xs font-medium text-amber-700">{label}</span></div>
            <p className="text-lg font-bold leading-tight" style={{color}}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Goal cards */}
      {intel.goal_cards.length > 0 ? (
        <div className="space-y-4">
          {intel.goal_cards.map((g, i) => (
            <motion.div key={g.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              transition={{delay:0.05*i}}
              className={cn('rounded-2xl border bg-white p-5',
                g.status==='ACHIEVED' ? 'border-emerald-300 bg-emerald-50/30' :
                !g.on_track && g.target_date ? 'border-red-200' : 'border-amber-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{g.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-amber-900">{g.name}</p>
                      {g.status==='ACHIEVED' && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✅ Achieved</span>
                      )}
                      {!g.on_track && g.status!=='ACHIEVED' && g.target_date && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Behind</span>
                      )}
                      <span className={cn('text-xs px-2 py-0.5 rounded-full',
                        g.priority==='HIGH' ? 'bg-red-100 text-red-700' :
                        g.priority==='MEDIUM' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600')}>
                        {g.priority}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 mt-0.5">{g.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {g.status !== 'ACHIEVED' && (
                    <button onClick={()=>setContributing(g)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                      style={{background:'linear-gradient(135deg,#F97316,#EA580C)'}}>
                      + Add
                    </button>
                  )}
                  <button onClick={()=>deleteMut.mutate(g.id)}
                    className="text-amber-300 hover:text-red-400 p-1"><X size={13}/></button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-amber-600 mb-1">
                  <span>{formatCurrencyCompact(g.current)} saved</span>
                  <span className="font-semibold">{g.pct_done}% of {formatCurrencyCompact(g.target)}</span>
                </div>
                <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
                  <motion.div className="h-full rounded-full transition-all"
                    initial={{width:0}} animate={{width:`${g.pct_done}%`}}
                    transition={{duration:0.8, delay:0.1*i}}
                    style={{background:g.color}}/>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-xs text-amber-500">Remaining</p>
                  <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(g.remaining)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-500">Monthly</p>
                  <p className="text-sm font-bold text-amber-900">{formatCurrencyCompact(g.monthly)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-500">ETA</p>
                  <p className={cn('text-sm font-bold', g.on_track ? 'text-emerald-700' : 'text-amber-700')}>
                    {g.months_to ? `${g.months_to} mo` : g.target_date || '—'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 p-10 text-center">
          <Target size={32} className="text-amber-300 mx-auto mb-3"/>
          <p className="text-amber-700 font-medium">No goals yet</p>
          <p className="text-amber-500 text-sm mt-1">Start with an Emergency Fund — aim for 6 months of expenses</p>
        </div>
      )}

      {/* AI Insights */}
      {intel.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-600"/><h3 className="text-sm font-semibold text-amber-900">Goal Intelligence</h3>
          </div>
          <div className="space-y-3">
            {intel.insights.map((ins, i) => {
              const cfg=SEV[ins.severity]; const Icon=cfg.icon
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
