'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Share2, Shield, Clock, Check, X, Plus, Eye, Trash2,
  ChevronRight, Copy, AlertCircle, Crown, UserCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserPublic { id: string; username: string; full_name?: string; avatar_url?: string }
interface PermissionGiven {
  id: string; grantee: UserPublic; modules: string[]; access_type: string;
  expires_at?: string; is_active: boolean; created_at: string;
}
interface PermissionReceived {
  id: string; owner: UserPublic; modules: string[]; access_type: string;
  expires_at?: string; is_active: boolean; created_at: string;
}
interface Invitation {
  id: string; invite_code: string; invitee_identifier: string; modules: string[];
  access_type: string; relationship_type: string; relationship_label?: string;
  message?: string;
  status: string; expires_at: string; created_at: string;
  invitee_user?: UserPublic;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_MODULES = [
  { id: 'banking',      label: 'Banking',       icon: '🏦' },
  { id: 'cards',        label: 'Credit Cards',  icon: '💳' },
  { id: 'transactions', label: 'Transactions',  icon: '↔️' },
  { id: 'emis',         label: 'EMIs',          icon: '📅' },
  { id: 'investments',  label: 'Investments',   icon: '📈' },
  { id: 'loans',        label: 'Loans & Debt',  icon: '💰' },
  { id: 'assets',       label: 'Assets',        icon: '🏠' },
  { id: 'net_worth',    label: 'Net Worth',     icon: '💎' },
  { id: 'income',       label: 'Income',        icon: '💵' },
  { id: 'insurance',    label: 'Insurance',     icon: '🛡️' },
  { id: 'goals',        label: 'Goals',         icon: '🎯' },
  { id: 'reports',      label: 'Reports',       icon: '📊' },
]

const ACCESS_TYPES = [
  { id: 'full_read',      label: 'Full Read',      desc: 'View everything including numbers' },
  { id: 'analytics_only', label: 'Analytics Only', desc: 'Charts and trends, no raw numbers' },
  { id: 'summary_only',   label: 'Summary Only',   desc: 'High-level summaries only' },
  { id: 'report_only',    label: 'Reports Only',   desc: 'View and download reports only' },
]

const RELATIONSHIP_TYPES = [
  'partner', 'spouse', 'parent', 'child', 'sibling',
  'friend', 'advisor', 'accountant', 'auditor', 'mentor', 'other',
]

const DURATION_OPTIONS = [
  { label: '1 day',     value: 1 },
  { label: '7 days',   value: 7 },
  { label: '30 days',  value: 30 },
  { label: '90 days',  value: 90 },
  { label: 'Permanent', value: null },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

function Avatar({ user, size = 36 }: { user: UserPublic; size?: number }) {
  const initials = (user.full_name || user.username).slice(0, 2).toUpperCase()
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #F97316, #7C3AED)' }}>
      {initials}
    </div>
  )
}

function Badge({ children, color = 'orange' }: { children: React.ReactNode; color?: 'orange' | 'green' | 'purple' | 'gray' }) {
  const styles = {
    orange: { background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' },
    green:  { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' },
    purple: { background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' },
    gray:   { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={styles[color]}>
      {children}
    </span>
  )
}

// ─── Create Invitation Modal ──────────────────────────────────────────────────

function CreateInviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [step, setStep]               = useState(1)
  const [identifier, setIdentifier]   = useState('')
  const [modules, setModules]         = useState<string[]>([])
  const [accessType, setAccessType]   = useState('full_read')
  const [relType, setRelType]         = useState('other')
  const [relLabel, setRelLabel]       = useState('')
  const [duration, setDuration]       = useState<number | null>(null)
  const [message, setMessage]         = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/sharing/invitations', {
      invitee_identifier: identifier,
      modules,
      access_type: accessType,
      relationship_type: relType,
      relationship_label: relLabel || undefined,
      access_duration_days: duration,
      message: message || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sharing-sent'] })
      const code = res.data.invite_code
      toast.success(`Invitation created! Code: ${code}`)
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Failed to create invitation')
    },
  })

  function toggleModule(id: string) {
    setModules(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id])
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none'
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>

        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="font-semibold text-white">Share Financial Access</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Invite someone to view your financial data
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Who */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Username or Email *
            </label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              placeholder="username or email@example.com"
              className={inputCls} style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
          </div>

          {/* Relationship */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Relationship
              </label>
              <select value={relType} onChange={e => setRelType(e.target.value)}
                className={inputCls} style={{ ...inputStyle, appearance: 'none' }}>
                {RELATIONSHIP_TYPES.map(r => (
                  <option key={r} value={r} style={{ background: '#111827' }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Custom Label
              </label>
              <input type="text" value={relLabel} onChange={e => setRelLabel(e.target.value)}
                placeholder="e.g. My CA, Dad"
                className={inputCls} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
            </div>
          </div>

          {/* Modules */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Select Modules to Share *
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModules(m => m.length === ALL_MODULES.length ? [] : ALL_MODULES.map(x => x.id))}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: modules.length === ALL_MODULES.length ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.07)',
                  color: modules.length === ALL_MODULES.length ? '#fb923c' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${modules.length === ALL_MODULES.length ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                {modules.length === ALL_MODULES.length ? '✓ All' : 'Select All'}
              </button>
              {ALL_MODULES.map(m => (
                <button key={m.id} onClick={() => toggleModule(m.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: modules.includes(m.id) ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                    color: modules.includes(m.id) ? '#fb923c' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${modules.includes(m.id) ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Access Type */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Access Level
            </label>
            <div className="space-y-2">
              {ACCESS_TYPES.map(at => (
                <button key={at.id} onClick={() => setAccessType(at.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: accessType === at.id ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${accessType === at.id ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <div>
                    <p className="text-sm font-medium text-white">{at.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{at.desc}</p>
                  </div>
                  {accessType === at.id && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Access Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(d => (
                <button key={d.label} onClick={() => setDuration(d.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: duration === d.value ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)',
                    color: duration === d.value ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${duration === d.value ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Personal Message (optional)
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Hi, I'm sharing my investment portfolio with you for review..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none resize-none"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!identifier || modules.length === 0 || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: (!identifier || modules.length === 0)
                ? 'rgba(249,115,22,0.3)'
                : 'linear-gradient(135deg, #F97316, #ea580c)',
              cursor: (!identifier || modules.length === 0) ? 'not-allowed' : 'pointer',
            }}>
            {mutation.isPending ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function SharingView() {
  const qc = useQueryClient()
  const [tab, setTab]             = useState<'given' | 'received' | 'invitations'>('given')
  const [showModal, setShowModal] = useState(false)

  const { data: given = [] }       = useQuery<PermissionGiven[]>({
    queryKey: ['sharing-given'],
    queryFn: () => api.get('/sharing/permissions/given').then(r => r.data),
  })
  const { data: received = [] }    = useQuery<PermissionReceived[]>({
    queryKey: ['sharing-received'],
    queryFn: () => api.get('/sharing/permissions/received').then(r => r.data),
  })
  const { data: sentInvites = [] } = useQuery<Invitation[]>({
    queryKey: ['sharing-sent'],
    queryFn: () => api.get('/sharing/invitations/sent').then(r => r.data),
  })
  const { data: receivedInvites = [] } = useQuery<Invitation[]>({
    queryKey: ['sharing-received-invites'],
    queryFn: () => api.get('/sharing/invitations/received').then(r => r.data),
  })

  const revokePermission = useMutation({
    mutationFn: (id: string) => api.delete(`/sharing/permissions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sharing-given'] }); toast.success('Access revoked') },
  })

  const acceptInvite = useMutation({
    mutationFn: (code: string) => api.post(`/sharing/invitations/${code}/accept`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sharing-received-invites', 'sharing-received'] }); toast.success('Access granted!') },
  })

  const pendingInvites = receivedInvites.filter(i => i.status === 'pending')

  const tabs = [
    { id: 'given' as const,       label: 'Access Given',   count: given.length },
    { id: 'received' as const,    label: 'Access Received', count: received.length },
    { id: 'invitations' as const, label: 'Invitations',    count: pendingInvites.length + sentInvites.filter(i => i.status === 'pending').length },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1a2e' }}>Financial Sharing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(26,26,46,0.5)' }}>
            Securely share your financial life with trusted people
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}>
          <Plus className="w-4 h-4" /> Share Access
        </button>
      </div>

      {/* Pending invites banner */}
      {pendingInvites.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
          <p className="text-sm" style={{ color: '#fb923c' }}>
            You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''} awaiting your response.
          </p>
          <button onClick={() => setTab('invitations')}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg"
            style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>
            View
          </button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(26,26,46,0.06)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#1a1a2e' : 'rgba(26,26,46,0.5)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
            {t.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: tab === t.id ? '#F97316' : 'rgba(26,26,46,0.12)', color: tab === t.id ? 'white' : 'inherit' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Access Given ── */}
        {tab === 'given' && (
          <motion.div key="given" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {given.length === 0 ? (
              <EmptyState icon={<Share2 />} title="No access given"
                desc="You haven't shared your financial data with anyone yet. Click 'Share Access' to get started." />
            ) : (
              <div className="space-y-3">
                {given.map(p => (
                  <PermissionCard key={p.id} user={p.grantee} modules={p.modules}
                    accessType={p.access_type} expiresAt={p.expires_at}
                    onRevoke={() => revokePermission.mutate(p.id)}
                    isOwner />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Access Received ── */}
        {tab === 'received' && (
          <motion.div key="received" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {received.length === 0 ? (
              <EmptyState icon={<Eye />} title="No shared access"
                desc="No one has shared their financial data with you yet." />
            ) : (
              <div className="space-y-3">
                {received.map(p => (
                  <PermissionCard key={p.id} user={p.owner} modules={p.modules}
                    accessType={p.access_type} expiresAt={p.expires_at}
                    isOwner={false} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Invitations ── */}
        {tab === 'invitations' && (
          <motion.div key="invitations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {pendingInvites.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgba(26,26,46,0.4)' }}>Received — Awaiting Response</h3>
                <div className="space-y-2">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="p-4 rounded-xl"
                      style={{ background: 'white', border: '1px solid rgba(26,26,46,0.08)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7C3AED, #F97316)' }}>
                          {(inv.invitee_user?.full_name || inv.invitee_identifier).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: '#1a1a2e' }}>
                            {inv.invitee_user?.full_name || inv.invitee_identifier}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(26,26,46,0.5)' }}>
                            wants to share: {inv.modules.slice(0, 3).join(', ')}{inv.modules.length > 3 ? ` +${inv.modules.length - 3}` : ''}
                          </p>
                          {inv.message && (
                            <p className="text-xs mt-1 italic" style={{ color: 'rgba(26,26,46,0.45)' }}>
                              &ldquo;{inv.message}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => acceptInvite.mutate(inv.invite_code)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, #F97316, #ea580c)' }}>
                            <Check className="w-3 h-3" /> Accept
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(26,26,46,0.06)', color: 'rgba(26,26,46,0.6)' }}>
                            <X className="w-3 h-3" /> Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sentInvites.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgba(26,26,46,0.4)' }}>Sent Invitations</h3>
                <div className="space-y-2">
                  {sentInvites.map(inv => (
                    <div key={inv.id} className="p-4 rounded-xl flex items-center gap-3"
                      style={{ background: 'white', border: '1px solid rgba(26,26,46,0.08)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1a1a2e' }}>
                          {inv.invitee_user?.full_name || inv.invitee_identifier}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(26,26,46,0.5)' }}>
                          {inv.modules.length} module{inv.modules.length !== 1 ? 's' : ''} · {inv.access_type.replace('_', ' ')}
                        </p>
                      </div>
                      <Badge color={
                        inv.status === 'pending' ? 'orange' :
                        inv.status === 'accepted' ? 'green' : 'gray'
                      }>
                        {inv.status}
                      </Badge>
                      {inv.status === 'pending' && (
                        <button onClick={() => {
                          navigator.clipboard.writeText(inv.invite_code)
                          toast.success('Invite code copied!')
                        }}
                          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                          style={{ color: 'rgba(26,26,46,0.4)' }} title="Copy invite code">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingInvites.length === 0 && sentInvites.length === 0 && (
              <EmptyState icon={<Users />} title="No invitations"
                desc="Send an invitation to share your financial data with a trusted person." />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && <CreateInviteModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Permission Card ──────────────────────────────────────────────────────────

function PermissionCard({
  user, modules, accessType, expiresAt, isOwner, onRevoke,
}: {
  user: UserPublic; modules: string[]; accessType: string;
  expiresAt?: string; isOwner: boolean; onRevoke?: () => void;
}) {
  const moduleLabels = ALL_MODULES.filter(m => modules.includes(m.id))
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false
  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="p-4 rounded-xl"
      style={{ background: 'white', border: '1px solid rgba(26,26,46,0.08)', opacity: expired ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>
              {user.full_name || user.username}
            </p>
            <span className="text-xs" style={{ color: 'rgba(26,26,46,0.4)' }}>@{user.username}</span>
            {isOwner
              ? <Badge color="orange"><Crown className="w-2.5 h-2.5 inline mr-0.5" />You shared</Badge>
              : <Badge color="purple"><UserCheck className="w-2.5 h-2.5 inline mr-0.5" />Shared with you</Badge>}
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge color={
              accessType === 'full_read' ? 'green' :
              accessType === 'analytics_only' ? 'orange' : 'gray'
            }>
              <Shield className="w-2.5 h-2.5 inline mr-0.5" />
              {ACCESS_TYPES.find(a => a.id === accessType)?.label || accessType}
            </Badge>
            {expiresAt && !expired && daysLeft !== null && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(26,26,46,0.45)' }}>
                <Clock className="w-3 h-3" />
                {daysLeft > 0 ? `${daysLeft}d left` : 'Expiring today'}
              </span>
            )}
            {expired && <Badge color="gray">Expired</Badge>}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {moduleLabels.slice(0, 5).map(m => (
              <span key={m.id} className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(26,26,46,0.05)', color: 'rgba(26,26,46,0.55)' }}>
                {m.icon} {m.label}
              </span>
            ))}
            {moduleLabels.length > 5 && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(26,26,46,0.05)', color: 'rgba(26,26,46,0.55)' }}>
                +{moduleLabels.length - 5} more
              </span>
            )}
          </div>
        </div>

        {isOwner && onRevoke && (
          <button onClick={onRevoke}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
            style={{ color: 'rgba(26,26,46,0.3)' }} title="Revoke access">
            <Trash2 className="w-4 h-4 hover:text-red-400" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
        style={{ background: 'rgba(26,26,46,0.06)', color: 'rgba(26,26,46,0.3)' }}>
        {icon}
      </div>
      <p className="text-sm font-medium" style={{ color: '#1a1a2e' }}>{title}</p>
      <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'rgba(26,26,46,0.45)' }}>{desc}</p>
    </div>
  )
}
