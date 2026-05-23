'use client'
import { LayoutDashboard, Landmark, CreditCard, BarChart3, RefreshCw } from 'lucide-react'
import { useUIStore, ViewId } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

const BOTTOM_NAV = [
  { view: 'dashboard'   as ViewId, icon: LayoutDashboard, label: 'Home'    },
  { view: 'banking'     as ViewId, icon: Landmark,        label: 'Banking' },
  { view: 'cards'       as ViewId, icon: CreditCard,      label: 'Cards'   },
  { view: 'investments' as ViewId, icon: BarChart3,       label: 'Invest'  },
  { view: 'recurring'   as ViewId, icon: RefreshCw,       label: 'Recurring'},
]

export function MobileBottomNav() {
  const isMobile = useIsMobile()
  const { currentView, setView, mobileSidebarOpen } = useUIStore()

  if (!isMobile || mobileSidebarOpen) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: '#16100C',
        borderTop: '1px solid rgba(255,255,255,0.09)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {BOTTOM_NAV.map(({ view, icon: Icon, label }) => {
        const active = currentView === view
        return (
          <button
            key={view}
            onClick={() => setView(view)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative"
            style={{ color: active ? '#F97316' : 'rgba(255,255,255,0.38)' }}
          >
            <Icon
              className={cn('w-5 h-5 transition-transform', active && 'scale-110')}
              strokeWidth={active ? 2.3 : 1.7}
            />
            <span className="text-[10px] font-medium leading-none">{label}</span>
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: '#F97316' }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
