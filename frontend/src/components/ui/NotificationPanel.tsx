'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Zap, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { insightsApi } from '@/lib/api'
import { Insight } from '@/types'
import { formatDate } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

const SEV_CFG = {
  CRITICAL: {
    dot: '#EF4444', bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C',
    icon: AlertTriangle, iconColor: '#EF4444',
  },
  WARNING: {
    dot: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', text: '#B45309',
    icon: TrendingUp, iconColor: '#F59E0B',
  },
  INFO: {
    dot: '#F97316', bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C',
    icon: Zap, iconColor: '#F97316',
  },
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const { setView } = useUIStore()

  const { data: insights = [] } = useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => (await insightsApi.list({ unread_only: false, limit: 20 })).data,
    refetchInterval: 60_000,
  })

  const unread = insights.filter((i) => !i.is_read && !i.is_dismissed).length

  const markRead = useMutation({
    mutationFn: (id: string) => insightsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => insightsApi.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  })

  const markAllRead = async () => {
    const unreadItems = insights.filter((i) => !i.is_read)
    await Promise.all(unreadItems.map((i) => insightsApi.markRead(i.id)))
    qc.invalidateQueries({ queryKey: ['insights'] })
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Mark visible as read when panel opens
  useEffect(() => {
    if (open) {
      const unreadItems = insights.filter((i) => !i.is_read && !i.is_dismissed)
      unreadItems.forEach((i) => markRead.mutate(i.id))
    }
  }, [open])

  const visible = insights.filter((i) => !i.is_dismissed)

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[#FFF1E6] active:scale-95"
        style={{ color: open ? '#F97316' : '#6B6460' }}
      >
        <Bell className="w-4 h-4" strokeWidth={2} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
            style={{ background: '#F97316', boxShadow: '0 0 0 2px #fff' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-10 w-[340px] rounded-2xl overflow-hidden z-50"
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #E8E2DB',
              boxShadow: '0 16px 48px rgba(24,18,14,0.14), 0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1.5px solid #F0EBE5' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '1px solid #FDC888' }}>
                  <Bell className="w-3 h-3" style={{ color: '#EA580C' }} strokeWidth={2.2} />
                </div>
                <span className="text-[13px] font-bold" style={{ color: '#18120E', letterSpacing: '-0.015em' }}>
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: '#F97316' }}>
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md hover:bg-[#FFF1E6] transition-colors"
                    style={{ color: '#F97316' }}>
                    <CheckCheck className="w-3.5 h-3.5 inline mr-1" />
                    All read
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
                  <X className="w-3.5 h-3.5" style={{ color: '#A09890' }} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto no-scrollbar">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: '#FFF1E6', border: '1.5px solid #FED7AA' }}>
                    <Bell className="w-4 h-4" style={{ color: '#F97316' }} strokeWidth={1.8} />
                  </div>
                  <p className="text-[13px] font-medium" style={{ color: '#18120E' }}>All caught up</p>
                  <p className="text-[12px]" style={{ color: '#A09890' }}>No notifications yet</p>
                </div>
              ) : (
                <div className="py-1">
                  {visible.map((ins) => {
                    const cfg = SEV_CFG[ins.severity] ?? SEV_CFG.INFO
                    const Icon = cfg.icon
                    return (
                      <div
                        key={ins.id}
                        className="group relative px-4 py-3 transition-colors hover:bg-[#FAF7F4]"
                        style={{ borderBottom: '1px solid #F5F0EB' }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Severity dot + icon */}
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: cfg.iconColor }} strokeWidth={2} />
                          </div>

                          <div className="flex-1 min-w-0 pr-5">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {!ins.is_read && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: cfg.dot }} />
                              )}
                              <p className="text-[12.5px] font-semibold leading-snug truncate"
                                style={{ color: '#18120E', letterSpacing: '-0.01em' }}>
                                {ins.title}
                              </p>
                            </div>
                            <p className="text-[11.5px] leading-snug line-clamp-2"
                              style={{ color: '#6B6460' }}>
                              {ins.body}
                            </p>
                            <p className="text-[10.5px] mt-1" style={{ color: '#A09890' }}>
                              {formatDate(ins.created_at, 'dd MMM · HH:mm')}
                            </p>
                          </div>
                        </div>

                        {/* Dismiss button */}
                        <button
                          onClick={() => dismiss.mutate(ins.id)}
                          className="absolute top-3 right-3 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#EDE8E2]"
                        >
                          <X className="w-3 h-3" style={{ color: '#A09890' }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {visible.length > 0 && (
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderTop: '1.5px solid #F0EBE5', background: '#FAF7F4' }}>
                <span className="text-[11px]" style={{ color: '#A09890' }}>
                  {visible.length} notification{visible.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => { setView('dashboard'); setOpen(false) }}
                  className="text-[11px] font-semibold transition-colors hover:opacity-70"
                  style={{ color: '#F97316' }}>
                  View all insights →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
