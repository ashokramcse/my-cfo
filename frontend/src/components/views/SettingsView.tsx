'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Settings, User, Database, Shield, Bell,
  Lock, Save, Download, Eye, EyeOff, LogOut, Monitor,
  CheckCircle2, Edit3, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

// ── Section header ─────────────────────────────────────────────────────────────
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

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? '#F97316' : '#EDE8E2' }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ left: value ? '1.25rem' : '0.125rem' }} />
    </button>
  )
}

export function SettingsView() {
  const qc = useQueryClient()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  // Profile
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get('/auth/me')).data,
  })

  // Editable profile state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name || '', email: profile.email || '' })
  }, [profile])

  const saveProfile = useMutation({
    mutationFn: async () => api.patch('/auth/profile', profileForm),
    onSuccess: () => {
      setProfileMsg({ ok: true, text: 'Profile updated' })
      setEditingProfile(false)
      refetchProfile()
      setTimeout(() => setProfileMsg(null), 3000)
    },
    onError: (e: any) => setProfileMsg({ ok: false, text: e?.response?.data?.detail || 'Update failed' }),
  })

  // Sessions
  const { data: sessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => (await api.get('/auth/sessions')).data,
  })

  const revokeSession = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/auth/sessions/${id}`); qc.invalidateQueries({ queryKey: ['auth-sessions'] }) },
  })

  const revokeAll = useMutation({
    mutationFn: async () => { await api.post('/auth/logout-all'); await logout(); router.replace('/login') },
  })

  // Password
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwShowOld, setPwShowOld] = useState(false)
  const [pwShowNew, setPwShowNew] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const changePassword = useMutation({
    mutationFn: async () => {
      if (pwNew !== pwConfirm) throw new Error('Passwords do not match')
      if (pwNew.length < 8) throw new Error('Minimum 8 characters required')
      await api.post('/auth/change-password', { current_password: pwOld, new_password: pwNew })
    },
    onSuccess: () => {
      setPwMsg({ ok: true, text: 'Password changed successfully' })
      setPwOld(''); setPwNew(''); setPwConfirm('')
      setTimeout(() => setPwMsg(null), 3000)
    },
    onError: (e: any) => setPwMsg({ ok: false, text: e?.response?.data?.detail || e.message || 'Failed' }),
  })

  // Notifications (localStorage)
  const [notifLoan, setNotifLoan]   = useState(true)
  const [notifGoal, setNotifGoal]   = useState(true)
  const [notifNW, setNotifNW]       = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setNotifLoan(localStorage.getItem('notif_loan_overdue') !== 'false')
    setNotifGoal(localStorage.getItem('notif_goal_milestone') !== 'false')
    setNotifNW(localStorage.getItem('notif_net_worth') === 'true')
  }, [])

  const toggleNotif = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val); localStorage.setItem(key, String(val))
  }

  // Export to Excel
  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    setExporting(true)
    try {
      const [nwRes, cardsRes, txRes, loansRes, invRes, assetsRes, bankRes, insRes, goalsRes] = await Promise.all([
        api.get('/net-worth/current'),
        api.get('/cards?page_size=200'),
        api.get('/transactions?page=1&page_size=500'),
        api.get('/loans'),
        api.get('/investments'),
        api.get('/assets'),
        api.get('/bank-accounts'),
        api.get('/insurance'),
        api.get('/goals'),
      ])

      const wb = XLSX.utils.book_new()

      // Net Worth summary sheet
      const nw = nwRes.data
      const nwRows = [
        ['Metric', 'Value'],
        ['Net Worth', nw.net_worth],
        ['Total Assets', nw.total_assets],
        ['Total Liabilities', nw.total_liabilities],
        ['Liquid Net Worth', nw.liquid_net_worth],
        ['Bank Total', nw.bank_total],
        ['Investment Value', nw.investment_value],
        ['Asset Value', nw.asset_value],
        ['Loan Outstanding', nw.loan_outstanding],
        ['CC Outstanding', nw.cc_outstanding],
        ['Debt Ratio %', nw.debt_ratio],
        ['Health Score', nw.health_score],
        ['Emergency Months', nw.emergency_months],
        ['Export Date', new Date().toISOString()],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nwRows), 'Net Worth')

      // Bank Accounts
      const banks = bankRes.data?.items || bankRes.data || []
      if (banks.length) {
        const bankRows = [['Nickname', 'Bank', 'Type', 'Balance', 'Min Balance', 'Interest Rate', 'Is Primary', 'Is Active']]
        banks.forEach((b: any) => bankRows.push([b.nickname, b.bank_name, b.account_type, b.current_balance, b.minimum_balance, b.interest_rate, b.is_primary, b.is_active]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bankRows), 'Bank Accounts')
      }

      // Transactions
      const txs = txRes.data?.items || []
      if (txs.length) {
        const txRows = [['Date', 'Description', 'Merchant', 'Amount', 'Type', 'Category', 'Recurring', 'Suspicious']]
        txs.forEach((t: any) => txRows.push([t.transaction_date, t.description, t.merchant_name, t.amount, t.tx_type, t.category, t.is_recurring, t.is_suspicious]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Transactions')
      }

      // Credit Cards
      const cards = cardsRes.data?.items || []
      if (cards.length) {
        const cardRows = [['Bank', 'Last Four', 'Type', 'Credit Limit', 'Outstanding', 'Min Due', 'Due Date', 'Utilization %']]
        cards.forEach((c: any) => cardRows.push([c.bank_name, c.last_four, c.card_type, c.credit_limit, c.current_outstanding, c.minimum_due, c.payment_due_date, c.utilization_pct]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cardRows), 'Credit Cards')
      }

      // Loans
      const loans = loansRes.data?.items || loansRes.data || []
      if (loans.length) {
        const loanRows = [['Nickname', 'Type', 'Lender', 'Principal', 'Outstanding', 'EMI', 'Rate %', 'Remaining Months', 'Status']]
        loans.forEach((l: any) => loanRows.push([l.nickname, l.loan_type, l.lender_name, l.principal_amount, l.outstanding_balance, l.emi_amount, l.interest_rate, l.remaining_months, l.status]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(loanRows), 'Loans')
      }

      // Investments
      const invs = invRes.data || []
      if (invs.length) {
        const invRows = [['Name', 'Type', 'Invested', 'Current Value', 'P&L', 'Return %', 'SIP Amount', 'Is SIP', 'Is Locked']]
        invs.forEach((i: any) => invRows.push([i.name, i.investment_type, i.invested_amount, i.current_value, i.unrealized_pnl, i.return_pct, i.sip_amount, i.is_sip, i.is_locked]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invRows), 'Investments')
      }

      // Assets
      const assets = assetsRes.data || []
      if (assets.length) {
        const aRows = [['Name', 'Type', 'Purchase Value', 'Current Value', 'Appreciation %', 'Location', 'Notes']]
        assets.forEach((a: any) => aRows.push([a.name, a.asset_type, a.purchase_value, a.current_value, a.appreciation_pct, a.location, a.notes]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aRows), 'Assets')
      }

      // Insurance
      const ins = insRes.data?.items || insRes.data || []
      if (ins.length) {
        const iRows = [['Policy Name', 'Type', 'Insurer', 'Premium', 'Frequency', 'Sum Assured', 'Renewal Date', 'Is Active']]
        ins.forEach((i: any) => iRows.push([i.policy_name, i.insurance_type, i.insurer, i.premium_amount, i.premium_frequency, i.sum_assured, i.renewal_date, i.is_active]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iRows), 'Insurance')
      }

      // Goals
      const goals = goalsRes.data?.items || goalsRes.data || []
      if (goals.length) {
        const gRows = [['Name', 'Target Amount', 'Current Amount', 'Progress %', 'Target Date', 'Category', 'Status']]
        goals.forEach((g: any) => gRows.push([g.name, g.target_amount, g.current_amount, g.progress_pct, g.target_date, g.category, g.status]))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gRows), 'Goals')
      }

      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `mycfo-export-${date}.xlsx`)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader icon={Settings} title="Settings" subtitle="Account, security, notifications and data" />
      <div className="p-3 sm:p-6 xl:p-8 max-w-[860px] mx-auto space-y-5">

        {/* ── Profile ─────────────────────────────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={User}
            iconBg="linear-gradient(135deg, #FFF0E0, #FFD9B0)"
            iconBorder="#FDC888" iconColor="#EA580C"
            title="Profile" subtitle="Your account information"
          />

          {!editingProfile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Username',  value: profile?.username  || '—' },
                  { label: 'Full Name', value: profile?.full_name || '—' },
                  { label: 'Email',     value: profile?.email     || '—' },
                  { label: 'Currency',  value: 'INR ₹' },
                  { label: 'Timezone',  value: 'Asia / Kolkata' },
                  { label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' }) : '—' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3.5"
                    style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#A09890' }}>{item.label}</p>
                    <p className="text-sm font-semibold truncate" style={{ color: '#18120E' }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setEditingProfile(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
                <Edit3 size={13} /> Edit Profile
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#A09890' }}>Full Name</label>
                  <input value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#A09890' }}>Email</label>
                  <input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }} />
                </div>
              </div>
              {profileMsg && (
                <div className="text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ background: profileMsg.ok ? '#ECFDF5' : '#FEF2F2', color: profileMsg.ok ? '#059669' : '#DC2626' }}>
                  {profileMsg.text}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: '#F97316' }}>
                  <Save size={13} /> {saveProfile.isPending ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditingProfile(false); setProfileMsg(null) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Notifications ───────────────────────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={Bell}
            iconBg="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
            iconBorder="#C4B5FD" iconColor="#7C3AED"
            title="Notifications" subtitle="Alert preferences"
          />
          <div className="space-y-3">
            {[
              { label: 'Loan Overdue Alerts', sub: 'Alert when a loan becomes overdue', key: 'notif_loan_overdue', val: notifLoan, setter: setNotifLoan },
              { label: 'Goal Milestone Alerts', sub: 'Alert at 25%, 50%, 75%, 100% completion', key: 'notif_goal_milestone', val: notifGoal, setter: setNotifGoal },
              { label: 'Net Worth Change Alerts', sub: 'Alert on significant net worth changes (>5%)', key: 'notif_net_worth', val: notifNW, setter: setNotifNW },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#18120E' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A09890' }}>{item.sub}</p>
                </div>
                <Toggle value={item.val} onChange={v => toggleNotif(item.key, v, item.setter)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Security ────────────────────────────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={Lock}
            iconBg="linear-gradient(135deg, #FEF2F2, #FEE2E2)"
            iconBorder="#FECACA" iconColor="#DC2626"
            title="Security" subtitle="Password and active sessions"
          />

          {/* Change Password */}
          <p className="text-sm font-bold mb-3" style={{ color: '#18120E' }}>Change Password</p>
          <div className="space-y-3 mb-7">
            <div className="relative">
              <input type={pwShowOld ? 'text' : 'password'} value={pwOld} onChange={e => setPwOld(e.target.value)}
                placeholder="Current password"
                className="w-full rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }} />
              <button type="button" onClick={() => setPwShowOld(!pwShowOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#A09890' }}>
                {pwShowOld ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="relative">
              <input type={pwShowNew ? 'text' : 'password'} value={pwNew} onChange={e => setPwNew(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }} />
              <button type="button" onClick={() => setPwShowNew(!pwShowNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#A09890' }}>
                {pwShowNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2', color: '#18120E' }} />
            {pwMsg && (
              <div className="text-xs font-medium px-3 py-2 rounded-lg"
                style={{ background: pwMsg.ok ? '#ECFDF5' : '#FEF2F2', color: pwMsg.ok ? '#059669' : '#DC2626' }}>
                {pwMsg.text}
              </div>
            )}
            <button onClick={() => changePassword.mutate()}
              disabled={!pwOld || !pwNew || !pwConfirm || changePassword.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: '#F97316' }}>
              <Lock size={13} /> {changePassword.isPending ? 'Changing…' : 'Change Password'}
            </button>
          </div>

          {/* Active Sessions */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: '#18120E' }}>Active Sessions</p>
            <button onClick={() => revokeAll.mutate()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
              <LogOut size={11} className="inline mr-1" />Sign out all
            </button>
          </div>
          <div className="space-y-2">
            {(sessions || []).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
                <Monitor size={15} style={{ color: '#F97316', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#18120E' }}>
                    {s.device_name || 'Unknown Device'}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: '#A09890' }}>
                    {s.ip_address} · Last active {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
                <button onClick={() => revokeSession.mutate(s.id)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg hover:opacity-80"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>Revoke</button>
              </div>
            ))}
            {(!sessions || sessions.length === 0) && (
              <p className="text-xs text-center py-4" style={{ color: '#A09890' }}>No other active sessions</p>
            )}
          </div>
        </div>

        {/* ── Data Management ─────────────────────────────────────── */}
        <div className="card p-6">
          <SectionHeader
            icon={Database}
            iconBg="linear-gradient(135deg, #EFF6FF, #DBEAFE)"
            iconBorder="#93C5FD" iconColor="#1D4ED8"
            title="Data Management" subtitle="Export your complete financial data"
          />
          <div className="space-y-3">
            <div className="p-4 rounded-xl" style={{ background: '#FAF7F4', border: '1.5px solid #EDE8E2' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#18120E' }}>Export All Data as Excel</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A09890' }}>
                    Downloads a .xlsx file with separate sheets for: Net Worth, Bank Accounts, Transactions, Credit Cards, Loans, Investments, Assets, Insurance, Goals
                  </p>
                </div>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-60 flex-shrink-0"
                  style={{ background: '#1D4ED8' }}>
                  <Download size={13} /> {exporting ? 'Exporting…' : 'Export Excel'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['Net Worth', 'Bank Accounts', 'Transactions', 'Credit Cards', 'Loans', 'Investments', 'Assets', 'Insurance', 'Goals'].map(s => (
                  <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                    style={{ background: '#DBEAFE', color: '#1D4ED8' }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs" style={{ color: '#A09890' }}>My CFO · Personal Finance OS</p>
          <p className="text-xs font-mono" style={{ color: '#C8C2BB' }}>FastAPI + Next.js 15</p>
        </div>

      </div>
    </>
  )
}
