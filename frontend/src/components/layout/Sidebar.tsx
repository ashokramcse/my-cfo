'use client'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, CreditCard, ArrowLeftRight, Calendar, Users, FileText, BarChart3, Settings, ChevronLeft, Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, ViewId } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cardsApi, transactionsApi, emisApi, friendsApi, reportsApi, insightsApi, statementsApi } from '@/lib/api'

const NAV: { view: ViewId; icon: React.ElementType; label: string }[] = [
  { view: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { view: 'cards',        icon: CreditCard,      label: 'Cards'        },
  { view: 'transactions', icon: ArrowLeftRight,  label: 'Transactions' },
  { view: 'emis',         icon: Calendar,        label: 'EMI Tracker'  },
  { view: 'friends',      icon: Users,           label: 'Friend EMIs'  },
  { view: 'statements',   icon: FileText,        label: 'Statements'   },
  { view: 'reports',      icon: BarChart3,       label: 'Reports'      },
  { view: 'settings',     icon: Settings,        label: 'Settings'     },
]

// Map each view to the queries it needs — prefetched on hover
const VIEW_PREFETCH: Record<ViewId, (qc: ReturnType<typeof useQueryClient>) => void> = {
  dashboard:    (qc) => {
    qc.prefetchQuery({ queryKey: ['dashboard'],    queryFn: () => reportsApi.dashboard().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['insights'],     queryFn: () => insightsApi.list({ unread_only: true, limit: 5 }).then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['emi-forecast'], queryFn: () => emisApi.forecast(6).then(r => r.data) })
  },
  cards:        (qc) => qc.prefetchQuery({ queryKey: ['cards'],        queryFn: () => cardsApi.list().then(r => r.data.items) }),
  transactions: (qc) => qc.prefetchQuery({ queryKey: ['transactions', 1, '', 'ALL', ''], queryFn: () => transactionsApi.list({ page: 1, page_size: 50 }).then(r => r.data) }),
  emis:         (qc) => {
    qc.prefetchQuery({ queryKey: ['emis', 'ACTIVE'], queryFn: () => emisApi.list({ status: 'ACTIVE' }).then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['emi-forecast'],   queryFn: () => emisApi.forecast(6).then(r => r.data) })
  },
  friends:      (qc) => qc.prefetchQuery({ queryKey: ['friends'],      queryFn: () => friendsApi.list().then(r => r.data) }),
  statements:   (qc) => qc.prefetchQuery({ queryKey: ['statements'],   queryFn: () => statementsApi.list({}).then(r => r.data) }),
  reports:      (qc) => {
    qc.prefetchQuery({ queryKey: ['spending'],     queryFn: () => reportsApi.spending().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['dashboard'],    queryFn: () => reportsApi.dashboard().then(r => r.data) })
  },
  settings:     () => {/* static page, no prefetch needed */},
}

export function Sidebar() {
  const qc = useQueryClient()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar, currentView, setView } = useUIStore()
  const isMobile = useIsMobile()

  const W = sidebarCollapsed ? 64 : 232

  const sidebarContent = (
    <>
      {/* Logo row */}
      <div className="flex items-center h-[60px] px-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 3px 10px rgba(249,115,22,0.45)' }}>
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="ml-2.5 flex-1 min-w-0">
          <div className="font-bold text-white text-sm leading-none tracking-tight">CC-Bill</div>
          <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>Personal Finance</div>
        </div>
        {isMobile ? (
          <button onClick={closeMobileSidebar}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X className="w-4 h-4" />
          </button>
        ) : (
          <motion.button onClick={toggleSidebar} whileTap={{ scale: 0.88 }}
            animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration: 0.22 }}
            className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/10', sidebarCollapsed ? 'ml-auto' : 'ml-1')}
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV.map(({ view, icon: Icon, label }) => {
          const active = currentView === view
          const prefetch = VIEW_PREFETCH[view]
          return (
            <button
              key={view}
              onClick={() => setView(view)}
              onMouseEnter={() => prefetch?.(qc)}
              onFocus={() => prefetch?.(qc)}
              className="w-full text-left"
            >
              <div className={cn('nav-item', active && 'active')} title={(!isMobile && sidebarCollapsed) ? label : undefined}>
                <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                {(isMobile || !sidebarCollapsed) && (
                  <span className="whitespace-nowrap">{label}</span>
                )}
              </div>
            </button>
          )
        })}
      </nav>

      {/* Owner footer */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className={cn('flex items-center rounded-lg p-2 gap-2.5', (!isMobile && sidebarCollapsed) ? 'justify-center' : '')}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>O</div>
          {(isMobile || !sidebarCollapsed) && (
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white leading-none">Owner</div>
              <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>Personal</div>
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[55]"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={closeMobileSidebar}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed left-0 top-0 h-screen w-[260px] z-[60] flex flex-col overflow-hidden"
              style={{ background: '#16100C', borderRight: '1px solid rgba(255,255,255,0.07)' }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden"
      style={{ background: '#16100C', borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {sidebarContent}
    </motion.aside>
  )
}
