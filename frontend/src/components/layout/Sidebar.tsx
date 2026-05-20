'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Calendar,
  Users, FileText, BarChart3, Settings, ChevronLeft, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

const NAV = [
  { href: '/dashboard',    icon: LayoutDashboard,  label: 'Dashboard'     },
  { href: '/cards',        icon: CreditCard,        label: 'Cards'         },
  { href: '/transactions', icon: ArrowLeftRight,    label: 'Transactions'  },
  { href: '/emis',         icon: Calendar,          label: 'EMI Tracker'   },
  { href: '/friends',      icon: Users,             label: 'Friend EMIs'   },
  { href: '/statements',   icon: FileText,          label: 'Statements'    },
  { href: '/reports',      icon: BarChart3,         label: 'Reports'       },
  { href: '/settings',     icon: Settings,          label: 'Settings'      },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const W = sidebarCollapsed ? 72 : 240

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden"
      style={{
        background: 'hsl(var(--surface-1))',
        borderRight: '1px solid hsl(var(--border))',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)' }}>
          <Zap className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-3 flex-1 min-w-0"
            >
              <div className="font-bold text-foreground text-base leading-none">CC-Bill</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">Financial Intelligence</div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={toggleSidebar}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0',
            'text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors',
            sidebarCollapsed ? 'ml-auto' : 'ml-2',
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}>
              <div className={cn('nav-item', active && 'active')}
                title={sidebarCollapsed ? label : undefined}>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="whitespace-nowrap text-[13px]"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className={cn(
          'flex items-center rounded-xl p-2',
          sidebarCollapsed ? 'justify-center' : 'gap-3',
        )}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)' }}>
            O
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <div className="text-[13px] font-semibold text-foreground leading-none">Owner</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-none">Personal Finance</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
