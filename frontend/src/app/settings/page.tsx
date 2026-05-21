'use client'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Settings, User, Database, Zap, Shield, Bell,
  Building2, CheckCircle2, Lock, Cpu, GitBranch,
} from 'lucide-react'

const PROFILE_ROWS = [
  [
    { label: 'Full Name',  value: 'Owner',              icon: User     },
    { label: 'Username',   value: 'owner',              icon: User     },
    { label: 'Email',      value: 'owner@ccbill.local', icon: User     },
  ],
  [
    { label: 'Currency',   value: 'INR ₹',              icon: Database },
    { label: 'Timezone',   value: 'Asia / Kolkata',     icon: Database },
    { label: 'Mode',       value: 'Single-user',        icon: User     },
  ],
]

const FEATURES = [
  {
    icon: Zap,
    title: 'AI Insights',
    desc: 'Auto-generated financial insights from transactions — spending trends, EMI risk, cashback opportunities',
    badge: 'Active',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    iconBg: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)',
    iconBorder: '#FDC888',
    iconColor: '#EA580C',
  },
  {
    icon: Shield,
    title: 'AES-256 Encryption',
    desc: 'All sensitive card numbers and financial data encrypted at rest using industry-standard AES-256-GCM',
    badge: 'On',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    iconBg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
    iconBorder: '#93C5FD',
    iconColor: '#1D4ED8',
  },
  {
    icon: Cpu,
    title: 'Auto-Parse',
    desc: 'PDF statements and Cred screenshots parsed automatically via pdfplumber → PyMuPDF → Tesseract OCR pipeline',
    badge: 'Active',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    iconBg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
    iconBorder: '#86EFAC',
    iconColor: '#15803D',
  },
  {
    icon: Bell,
    title: 'Celery Workers',
    desc: 'Background task queue for async PDF parsing, insight generation and daily scheduled analysis',
    badge: 'Running',
    badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200',
    iconBg: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
    iconBorder: '#C4B5FD',
    iconColor: '#7C3AED',
  },
]

const BANKS = [
  { name: 'HDFC',             color: '#1a1a2e' },
  { name: 'ICICI',            color: '#7c1a2e' },
  { name: 'SBI',              color: '#0a1f44' },
  { name: 'Axis',             color: '#6b0a0a' },
  { name: 'Cred Screenshots', color: '#1a0f2e' },
  { name: 'All banks via OCR',color: '#1a3320' },
]

const TECH_STACK = [
  { label: 'Backend',    value: 'FastAPI + Python 3.13',    icon: GitBranch },
  { label: 'Frontend',   value: 'Next.js 15 + TypeScript',  icon: GitBranch },
  { label: 'Database',   value: 'PostgreSQL 17',            icon: Database  },
  { label: 'Cache',      value: 'Redis 7',                  icon: Cpu       },
  { label: 'Proxy',      value: 'nginx 1.27',               icon: Building2 },
  { label: 'Version',    value: 'v1.2.0',                   icon: CheckCircle2 },
]

function SectionHeader({ icon: Icon, iconBg, iconBorder, iconColor, title, subtitle }: {
  icon: React.ElementType
  iconBg: string; iconBorder: string; iconColor: string
  title: string; subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1.5px solid #EDE8E2' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, border: `1.5px solid ${iconBorder}` }}>
        <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: '#18120E' }}>{title}</h2>
        <p className="text-xs mt-0.5" style={{ color: '#A09890' }}>{subtitle}</p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader icon={Settings} title="Settings" subtitle="Platform configuration and profile" />
      <div className="p-3 sm:p-6 xl:p-8 max-w-[860px] mx-auto space-y-5">

        {/* ── Profile ───────────────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={User}
            iconBg="linear-gradient(135deg, #FFF0E0, #FFD9B0)"
            iconBorder="#FDC888" iconColor="#EA580C"
            title="Profile" subtitle="Single-user personal mode"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROFILE_ROWS.flat().map((item) => (
              <div key={item.label} className="rounded-xl p-3.5"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: '#A09890' }}>{item.label}</p>
                <p className="text-sm font-semibold" style={{ color: '#18120E' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Platform Features ─────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={Zap}
            iconBg="linear-gradient(135deg, #FFF0E0, #FFD9B0)"
            iconBorder="#FDC888" iconColor="#EA580C"
            title="Platform Features" subtitle="Active capabilities"
          />
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4 p-4 rounded-xl"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: f.iconBg, border: `1.5px solid ${f.iconBorder}` }}>
                  <f.icon className="w-4 h-4" style={{ color: f.iconColor }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: '#18120E' }}>{f.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#6B6460' }}>{f.desc}</p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${f.badgeClass}`}>
                  {f.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supported Banks ───────────────────────── */}
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

        {/* ── Tech Stack ────────────────────────────── */}
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

        {/* ── Footer ────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs" style={{ color: '#A09890' }}>CC-Bill · Personal Finance Intelligence</p>
          <p className="text-xs font-mono" style={{ color: '#C8C2BB' }}>Built with ❤️ using FastAPI + Next.js</p>
        </div>

      </div>
    </AppShell>
  )
}
