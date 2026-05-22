'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Settings, User, Database, Zap, Shield, Bell,
  Building2, CheckCircle2, Lock, Cpu, GitBranch,
  Save, TestTube2, Download, Trash2, Server,
} from 'lucide-react'
import { api } from '@/lib/api'

const OLLAMA_MODELS = ['llama3', 'qwen2.5', 'mistral', 'gemma2', 'llama3.2']

function SectionHeader({ icon: Icon, iconBg, iconBorder, iconColor, title, subtitle }: {
  icon: React.ElementType
  iconBg: string; iconBorder: string; iconColor: string
  title: string; subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1.5px solid #EDE8E2' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, border: `1.5px solid ${iconBorder}` }}>
        <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: '#18120E' }}>{title}</h2>
        <p className="text-xs mt-0.5" style={{ color: '#A09890' }}>{subtitle}</p>
      </div>
    </div>
  )
}

const BANKS = [
  { name: 'HDFC', color: '#1a1a2e' },
  { name: 'ICICI', color: '#7c1a2e' },
  { name: 'SBI', color: '#0a1f44' },
  { name: 'Axis', color: '#6b0a0a' },
  { name: 'Cred Screenshots', color: '#1a0f2e' },
  { name: 'All banks via OCR', color: '#1a3320' },
]

const TECH_STACK = [
  { label: 'Backend',  value: 'FastAPI + Python 3.13', icon: GitBranch },
  { label: 'Frontend', value: 'Next.js 15 + TypeScript', icon: GitBranch },
  { label: 'Database', value: 'PostgreSQL 17', icon: Database },
  { label: 'Cache',    value: 'Redis 7', icon: Cpu },
  { label: 'Proxy',    value: 'nginx 1.27', icon: Building2 },
  { label: 'Version',  value: 'v1.3.0', icon: CheckCircle2 },
]

export function SettingsView() {
  // Profile from /auth/me
  const { data: profile } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get('/auth/me')).data,
  })

  // AI CFO settings from localStorage
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  // Notification toggles (localStorage)
  const [notifLoanOverdue, setNotifLoanOverdue] = useState(true)
  const [notifGoalMilestone, setNotifGoalMilestone] = useState(true)
  const [notifNetWorthChange, setNotifNetWorthChange] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOllamaModel(localStorage.getItem('ollama_model') || 'llama3')
      setOllamaHost(localStorage.getItem('ollama_host') || 'http://localhost:11434')
      setNotifLoanOverdue(localStorage.getItem('notif_loan_overdue') !== 'false')
      setNotifGoalMilestone(localStorage.getItem('notif_goal_milestone') !== 'false')
      setNotifNetWorthChange(localStorage.getItem('notif_net_worth') === 'true')
    }
  }, [])

  const saveAiSettings = () => {
    localStorage.setItem('ollama_model', ollamaModel)
    localStorage.setItem('ollama_host', ollamaHost)
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 2000)
  }

  const testConnection = async () => {
    setTestStatus('testing')
    try {
      const resp = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(5000) })
      setTestStatus(resp.ok ? 'ok' : 'fail')
    } catch {
      setTestStatus('fail')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  const exportData = async () => {
    try {
      const [nw, cards, loans] = await Promise.all([
        api.get('/net-worth/current'),
        api.get('/cards'),
        api.get('/loans'),
      ])
      const blob = new Blob([JSON.stringify({ net_worth: nw.data, cards: cards.data, loans: loans.data }, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `finos-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
    } catch (e) {
      console.error('Export failed', e)
    }
  }

  const toggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val)
    localStorage.setItem(key, String(val))
  }

  return (
    <>
      <PageHeader icon={Settings} title="Settings" subtitle="Platform configuration and preferences" />
      <div className="p-3 sm:p-6 xl:p-8 max-w-[860px] mx-auto space-y-5">

        {/* ── Profile ── */}
        <div className="card p-6">
          <SectionHeader
            icon={User}
            iconBg="linear-gradient(135deg, #FFF0E0, #FFD9B0)"
            iconBorder="#FDC888" iconColor="#EA580C"
            title="Profile" subtitle="Your account information"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Username',  value: profile?.username  || '—' },
              { label: 'Full Name', value: profile?.full_name || '—' },
              { label: 'Email',     value: profile?.email     || '—' },
              { label: 'Currency',  value: 'INR ₹' },
              { label: 'Timezone',  value: 'Asia / Kolkata' },
              { label: 'Mode',      value: 'Single-user' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3.5"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: '#A09890' }}>{item.label}</p>
                <p className="text-sm font-semibold" style={{ color: '#18120E' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI CFO ── */}
        <div className="card p-6">
          <SectionHeader
            icon={Cpu}
            iconBg="linear-gradient(135deg, #FFF0E0, #FFD9B0)"
            iconBorder="#FDC888" iconColor="#EA580C"
            title="AI CFO — Ollama Settings" subtitle="Local LLM configuration"
          />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#A09890' }}>
                Model
              </label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
                {OLLAMA_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#A09890' }}>
                Ollama Host URL
              </label>
              <input
                type="url"
                value={ollamaHost}
                onChange={(e) => setOllamaHost(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: testStatus === 'ok' ? '#ECFDF5' : testStatus === 'fail' ? '#FEF2F2' : '#FAF7F4', border: '1.5px solid #EDE8E2', color: testStatus === 'ok' ? '#059669' : testStatus === 'fail' ? '#DC2626' : '#18120E' }}>
                <TestTube2 size={14} />
                {testStatus === 'testing' ? 'Testing…' : testStatus === 'ok' ? 'Connected!' : testStatus === 'fail' ? 'Failed' : 'Test Connection'}
              </button>
              <button
                onClick={saveAiSettings}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80"
                style={{ background: aiSaved ? '#059669' : '#F97316' }}>
                <Save size={14} />
                {aiSaved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Notifications ── */}
        <div className="card p-6">
          <SectionHeader
            icon={Bell}
            iconBg="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
            iconBorder="#C4B5FD" iconColor="#7C3AED"
            title="Notifications" subtitle="Alert preferences"
          />
          <div className="space-y-3">
            {[
              { label: 'Loan Overdue Alerts', sub: 'Alert when a loan becomes overdue', key: 'notif_loan_overdue', val: notifLoanOverdue, setter: setNotifLoanOverdue },
              { label: 'Goal Milestone Alerts', sub: 'Alert when a goal reaches 25%, 50%, 75%, 100%', key: 'notif_goal_milestone', val: notifGoalMilestone, setter: setNotifGoalMilestone },
              { label: 'Net Worth Change Alerts', sub: 'Alert on significant net worth changes (>5%)', key: 'notif_net_worth', val: notifNetWorthChange, setter: setNotifNetWorthChange },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#18120E' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A09890' }}>{item.sub}</p>
                </div>
                <button
                  onClick={() => toggle(item.key, !item.val, item.setter)}
                  className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                  style={{ background: item.val ? '#F97316' : '#EDE8E2' }}>
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: item.val ? '1.25rem' : '0.125rem' }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Data Export ── */}
        <div className="card p-6">
          <SectionHeader
            icon={Database}
            iconBg="linear-gradient(135deg, #EFF6FF, #DBEAFE)"
            iconBorder="#93C5FD" iconColor="#1D4ED8"
            title="Data Management" subtitle="Export and manage your data"
          />
          <div className="space-y-3">
            <button
              onClick={exportData}
              className="flex items-center gap-2.5 w-full p-3.5 rounded-xl text-sm font-semibold text-left transition-all hover:opacity-80"
              style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
              <Download size={16} style={{ color: '#1D4ED8' }} />
              Export Data as JSON
              <span className="ml-auto text-xs" style={{ color: '#A09890' }}>net worth, cards, loans</span>
            </button>
          </div>
          <div className="mt-4 p-4 rounded-xl" style={{ background: '#FFF5F5', border: '1.5px solid #FECACA' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#DC2626' }}>Danger Zone</p>
            <p className="text-xs" style={{ color: '#6B6460' }}>Account actions are irreversible. Contact admin for account deletion.</p>
          </div>
        </div>

        {/* ── Supported Banks ── */}
        <div className="card p-6">
          <SectionHeader
            icon={Building2}
            iconBg="linear-gradient(135deg, #EFF6FF, #DBEAFE)"
            iconBorder="#93C5FD" iconColor="#1D4ED8"
            title="Supported Banks" subtitle="PDF parsers with Tesseract OCR fallback"
          />
          <div className="flex flex-wrap gap-2">
            {BANKS.map((b) => (
              <span key={b.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                {b.name}
              </span>
            ))}
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div className="card p-6">
          <SectionHeader
            icon={GitBranch}
            iconBg="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
            iconBorder="#C4B5FD" iconColor="#7C3AED"
            title="Tech Stack" subtitle="Core dependencies and versions"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TECH_STACK.map((t) => (
              <div key={t.label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <t.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F97316' }} strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A09890' }}>{t.label}</p>
                  <p className="text-xs font-semibold truncate" style={{ color: '#18120E' }}>{t.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs" style={{ color: '#A09890' }}>CC-Bill · Personal Finance Intelligence</p>
          <p className="text-xs font-mono" style={{ color: '#C8C2BB' }}>Built with ❤️ using FastAPI + Next.js</p>
        </div>

      </div>
    </>
  )
}
