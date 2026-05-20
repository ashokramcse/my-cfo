'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Calendar, Users,
  FileText, BarChart3, Settings, ChevronLeft, Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cards', icon: CreditCard, label: 'Cards' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/emis', icon: Calendar, label: 'EMI Tracker' },
  { href: '/friends', icon: Users, label: 'Friend EMIs' },
  { href: '/statements', icon: FileText, label: 'Statements' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col border-r border-border bg-surface-1 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="font-bold text-foreground text-lg whitespace-nowrap">
              CC-Bill
            </motion.span>
          )}
        </AnimatePresence>
        <motion.button
          onClick={toggleSidebar}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}>
              <div className={cn('nav-item', isActive && 'active')}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="whitespace-nowrap text-sm">
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Owner badge */}
      <div className="border-t border-border p-3">
        <div className={cn('nav-item', !sidebarCollapsed && 'gap-3')}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
            O
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">Owner</div>
                <div className="text-xs text-muted-foreground truncate">Personal Finance</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
