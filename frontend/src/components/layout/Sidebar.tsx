'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, CreditCard, ArrowLeftRight, Calendar, Users, FileText, BarChart3, Settings, ChevronLeft, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

const NAV = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/cards',        icon: CreditCard,      label: 'Cards'        },
  { href: '/transactions', icon: ArrowLeftRight,  label: 'Transactions' },
  { href: '/emis',         icon: Calendar,        label: 'EMI Tracker'  },
  { href: '/friends',      icon: Users,           label: 'Friend EMIs'  },
  { href: '/statements',   icon: FileText,        label: 'Statements'   },
  { href: '/reports',      icon: BarChart3,       label: 'Reports'      },
  { href: '/settings',     icon: Settings,        label: 'Settings'     },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const W = sidebarCollapsed ? 64 : 232

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden"
      style={{ background: '#16100C', borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Logo row */}
      <div className="flex items-center h-[60px] px-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 3px 10px rgba(249,115,22,0.45)' }}>
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.12 }} className="ml-2.5 flex-1 min-w-0">
              <div className="font-bold text-white text-sm leading-none tracking-tight">CC-Bill</div>
              <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>Personal Finance</div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button onClick={toggleSidebar} whileTap={{ scale: 0.88 }}
          animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration: 0.22 }}
          className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/10', sidebarCollapsed ? 'ml-auto' : 'ml-1')}
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}>
              <div className={cn('nav-item', active && 'active')} title={sidebarCollapsed ? label : undefined}>
                <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }} className="whitespace-nowrap">{label}</motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Owner footer */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className={cn('flex items-center rounded-lg p-2 gap-2.5', sidebarCollapsed ? 'justify-center' : '')}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>O</div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                <div className="text-xs font-semibold text-white leading-none">Owner</div>
                <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>Personal</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
