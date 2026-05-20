'use client'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Settings, User, Database, Zap, Shield, Bell } from 'lucide-react'

const ITEMS = [
  { label: 'Full Name',    value: 'Owner'            },
  { label: 'Username',     value: 'owner'            },
  { label: 'Email',        value: 'owner@ccbill.local'},
  { label: 'Currency',     value: 'INR'              },
  { label: 'Timezone',     value: 'Asia/Kolkata'     },
]

const FEATURES = [
  { icon: Zap,      title: 'AI Insights',       desc: 'Auto-generated financial insights from your transactions', badge: 'Active' },
  { icon: Shield,   title: 'AES-256 Encryption', desc: 'All sensitive data encrypted at rest',                   badge: 'On' },
  { icon: Database, title: 'Auto-Parse',         desc: 'PDFs and screenshots parsed automatically via OCR',      badge: 'Active' },
  { icon: Bell,     title: 'Celery Workers',     desc: 'Background tasks for parsing and insight generation',    badge: 'Running' },
]

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6 xl:p-8 max-w-[800px] mx-auto">
        <PageHeader icon={Settings} title="Settings" subtitle="Platform configuration and profile" />

        <div className="space-y-5">
          {/* Profile */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <User className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="section-title">Profile</h2>
                <p className="section-sub">Single-user personal mode</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ITEMS.map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-border/50">
                  <div className="text-xs text-muted-foreground mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="section-title">Platform Features</h2>
                <p className="section-sub">Active capabilities</p>
              </div>
            </div>
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-border/40">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 flex-shrink-0">
                    <f.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{f.title}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  <span className="badge-success flex-shrink-0">{f.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Supported banks */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Database className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h2 className="section-title">Supported Banks</h2>
                <p className="section-sub">PDF parsers with OCR fallback</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['HDFC', 'ICICI', 'SBI', 'Axis', 'Cred Screenshots', 'All banks via OCR'].map((b) => (
                <span key={b} className="badge-neutral">{b}</span>
              ))}
            </div>
          </div>

          {/* Version */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">CC-Bill</div>
              <div className="text-xs text-muted-foreground font-mono">v1.0.0 · FastAPI + Next.js 15</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
