'use client'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Calendar, Users, FileText,
  BarChart3, Settings, ChevronLeft, Zap, X, TrendingUp, Landmark,
  Building2, Wallet, DollarSign, Shield, Target, Share2, LogOut,
  RefreshCw, PieChart, Telescope, Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, ViewId } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import {
  cardsApi, transactionsApi, emisApi, friendsApi, reportsApi,
  insightsApi, statementsApi, netWorthApi, bankAccountsApi,
  investmentsApi, loansApi, assetsApi, incomeApi, insuranceApi,
  goalsApi, api,
} from '@/lib/api'

// ─── Nav structure ────────────────────────────────────────────────────────────
type NavItem = { view: ViewId; icon: React.ElementType; label: string; emoji?: string }
type NavGroup = { group: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Command Center',
    items: [
      { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', emoji: '🏠' },
    ],
  },
  {
    group: 'Financial OS',
    items: [
      { view: 'net-worth',   icon: TrendingUp,  label: 'Net Worth',   emoji: '📊' },
      { view: 'banking',     icon: Landmark,    label: 'Banking',     emoji: '🏦' },
      { view: 'investments', icon: PieChart,    label: 'Investments', emoji: '📈' },
      { view: 'loans',       icon: Wallet,      label: 'Loans & Debt',emoji: '⚠️' },
      { view: 'assets',      icon: Building2,   label: 'Assets',      emoji: '🏠' },
    ],
  },
  {
    group: 'Money Flow',
    items: [
      { view: 'income',     icon: DollarSign, label: 'Income',    emoji: '💰' },
      { view: 'recurring',  icon: RefreshCw,  label: 'Recurring', emoji: '🔁' },
      { view: 'insurance',  icon: Shield,     label: 'Insurance', emoji: '🛡️' },
      { view: 'goals',      icon: Target,     label: 'Goals',     emoji: '🎯' },
    ],
  },
  {
    group: 'Credit & Cards',
    items: [
      { view: 'cards',        icon: CreditCard,     label: 'Cards',        emoji: '💳' },
      { view: 'transactions', icon: ArrowLeftRight, label: 'Transactions', emoji: '🧾' },
      { view: 'emis',         icon: Calendar,       label: 'Card EMIs',    emoji: '📅' },
      { view: 'friends',      icon: Users,          label: 'Lending',      emoji: '🤝' },
    ],
  },
  {
    group: 'Reports & Data',
    items: [
      { view: 'visualize',     icon: Telescope, label: 'Visualize',     emoji: '🔭' },
      { view: 'statements',    icon: FileText,  label: 'Statements',    emoji: '📄' },
      { view: 'reports',       icon: BarChart3, label: 'Reports',       emoji: '📊' },
      { view: 'smart-linking', icon: Link2,     label: 'Smart Linking', emoji: '🔗' },
    ],
  },
  {
    group: '',
    items: [
      { view: 'sharing',  icon: Share2,   label: 'Sharing'  },
      { view: 'settings', icon: Settings, label: 'Settings' },
    ],
  },
]

// ─── Prefetch map ─────────────────────────────────────────────────────────────
const VIEW_PREFETCH: Record<ViewId, (qc: ReturnType<typeof useQueryClient>) => void> = {
  dashboard:    (qc) => {
    qc.prefetchQuery({ queryKey: ['dashboard'],    queryFn: () => reportsApi.dashboard().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['insights'],     queryFn: () => insightsApi.list({ unread_only: true, limit: 5 }).then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['emi-forecast'], queryFn: () => emisApi.forecast(6).then(r => r.data) })
  },
  'net-worth':  (qc) => {
    qc.prefetchQuery({ queryKey: ['net-worth'],         queryFn: () => netWorthApi.current().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['net-worth-history'], queryFn: () => netWorthApi.history(12).then(r => r.data) })
  },
  banking:      (qc) => qc.prefetchQuery({ queryKey: ['bank-accounts'], queryFn: () => bankAccountsApi.list().then(r => r.data) }),
  investments:  (qc) => {
    qc.prefetchQuery({ queryKey: ['investments'],         queryFn: () => investmentsApi.list().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['investments-summary'], queryFn: () => investmentsApi.summary().then(r => r.data) })
  },
  loans:        (qc) => {
    qc.prefetchQuery({ queryKey: ['loans'],         queryFn: () => loansApi.list().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['loans-summary'], queryFn: () => loansApi.summary().then(r => r.data) })
  },
  assets:       (qc) => qc.prefetchQuery({ queryKey: ['assets'], queryFn: () => assetsApi.list().then(r => r.data) }),
  income:       (qc) => qc.prefetchQuery({ queryKey: ['income-intelligence'], queryFn: () => incomeApi.intelligence().then(r => r.data) }),
  recurring:    (qc) => qc.prefetchQuery({ queryKey: ['recurring-summary'],   queryFn: () => api.get('/recurring/summary').then(r => r.data) }),
  insurance:    (qc) => qc.prefetchQuery({ queryKey: ['insurance-intelligence'], queryFn: () => insuranceApi.intelligence().then(r => r.data) }),
  goals:        (qc) => qc.prefetchQuery({ queryKey: ['goal-intelligence'], queryFn: () => goalsApi.intelligence().then(r => r.data) }),
  cards:        (qc) => qc.prefetchQuery({ queryKey: ['cards'],        queryFn: () => cardsApi.list().then(r => r.data.items) }),
  transactions: (qc) => qc.prefetchQuery({ queryKey: ['transactions', 1, '', 'ALL', ''], queryFn: () => transactionsApi.list({ page: 1, page_size: 50 }).then(r => r.data) }),
  emis:         (qc) => {
    qc.prefetchQuery({ queryKey: ['emis', 'ACTIVE'], queryFn: () => emisApi.list({ status: 'ACTIVE' }).then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['emi-forecast'],   queryFn: () => emisApi.forecast(6).then(r => r.data) })
  },
  friends:      (qc) => qc.prefetchQuery({ queryKey: ['friends'],    queryFn: () => friendsApi.list().then(r => r.data) }),
  visualize:    (qc) => {
    qc.prefetchQuery({ queryKey: ['net-worth'],       queryFn: () => api.get('/net-worth/current').then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['net-worth-history'],queryFn: () => api.get('/net-worth/history').then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['bank-accounts'],   queryFn: () => api.get('/bank-accounts').then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['loans'],           queryFn: () => api.get('/loans').then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['investments'],     queryFn: () => api.get('/investments').then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['assets'],          queryFn: () => api.get('/assets').then(r => r.data) })
  },
  statements:   (qc) => qc.prefetchQuery({ queryKey: ['statements'], queryFn: () => statementsApi.list({}).then(r => r.data) }),
  reports:      (qc) => {
    qc.prefetchQuery({ queryKey: ['spending'],  queryFn: () => reportsApi.spending().then(r => r.data) })
    qc.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => reportsApi.dashboard().then(r => r.data) })
  },
  settings:     () => {},
  sharing:       () => {},
  'smart-linking': () => {},
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Sidebar() {
  const qc = useQueryClient()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar, currentView, setView } = useUIStore()
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const isMobile = useIsMobile()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  const userInitials = user ? (user.full_name || user.username).slice(0, 2).toUpperCase() : 'ME'
  const userDisplayName = user?.full_name || user?.username || 'You'
  const W = sidebarCollapsed ? 64 : 232

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center h-[60px] px-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 3px 10px rgba(249,115,22,0.45)' }}>
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="ml-2.5 flex-1 min-w-0">
          <div className="font-bold text-white text-sm leading-none tracking-tight">My CFO</div>
          <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Financial OS
          </div>
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
      <nav className="flex-1 py-2 px-2 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group || 'misc'} className="mb-1">
            {group && (isMobile || !sidebarCollapsed) && (
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'rgba(255,255,255,0.22)' }}>
                {group}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map(({ view, icon: Icon, label, emoji }) => {
                const active = currentView === view
                const prefetch = VIEW_PREFETCH[view]
                return (
                  <button key={view} onClick={() => setView(view)}
                    onMouseEnter={() => prefetch?.(qc)} onFocus={() => prefetch?.(qc)}
                    className="w-full text-left">
                    <div className={cn('nav-item', active && 'active')}
                      title={(!isMobile && sidebarCollapsed) ? label : undefined}>
                      {(isMobile || !sidebarCollapsed) && emoji ? (
                        <span className="text-[15px] flex-shrink-0 w-[17px] text-center leading-none">{emoji}</span>
                      ) : (
                        <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                      )}
                      {(isMobile || !sidebarCollapsed) && (
                        <span className="whitespace-nowrap">{label}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className={cn('flex items-center rounded-lg p-2 gap-2.5',
          (!isMobile && sidebarCollapsed) ? 'justify-center' : '')}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            {userInitials}
          </div>
          {(isMobile || !sidebarCollapsed) && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white leading-none truncate">{userDisplayName}</div>
                <div className="text-[10px] mt-0.5 leading-none truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {user?.email || 'Personal'}
                </div>
              </div>
              <button onClick={handleLogout} title="Sign out"
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
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
              style={{ background: 'rgba(24,18,14,0.5)' }}
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
