'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, currentView } = useUIStore()
  const isMobile = useIsMobile()

  return (
    <div className="flex min-h-screen" style={{ background: '#E6E0D8' }}>
      <Sidebar />
      <motion.main
        animate={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 64 : 232) }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="flex-1 min-h-screen min-w-0"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentView}
            initial={PAGE_TRANSITION.initial}
            animate={PAGE_TRANSITION.animate}
            exit={PAGE_TRANSITION.exit}
            transition={PAGE_TRANSITION.transition}
            className="min-h-screen"
            style={{ background: '#E6E0D8' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  )
}
