'use client'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Settings, User, Bell, Shield, Database, Zap } from 'lucide-react'
export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-[800px] mx-auto">
        <PageHeader icon={Settings} title="Settings" subtitle="Configure your financial intelligence platform" />

        <div className="space-y-6">
          {/* Profile */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Profile</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Full Name', value: 'Owner' },
                { label: 'Username', value: 'owner' },
                { label: 'Email', value: 'owner@ccbill.local' },
                { label: 'Currency', value: 'INR' },
                { label: 'Timezone', value: 'Asia/Kolkata' },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-white/3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">System</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Backend', value: 'FastAPI + PostgreSQL + Redis', status: 'operational' },
                { label: 'PDF Parser', value: 'pdfplumber + PyMuPDF + OCR', status: 'operational' },
                { label: 'Background Workers', value: 'Celery (pdf_parsing, insights)', status: 'operational' },
                { label: 'AI Insights', value: 'Rule-based engine (Ollama optional)', status: 'operational' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center p-3 rounded-xl bg-white/3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.value}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Security</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              {[
                '✅ AES-256-GCM encryption for sensitive data',
                '✅ JWT authentication with refresh tokens',
                '✅ PDF passwords never stored permanently',
                '✅ All data isolated per user',
                '✅ Rate limiting on all API endpoints',
                '✅ Audit logging for all write operations',
              ].map((item) => (
                <div key={item} className="p-3 rounded-xl bg-white/3">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
