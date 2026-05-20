'use client'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()
  const isMobile = useIsMobile()

  return (
    <div className="flex min-h-screen" style={{ background: '#E6E0D8' }}>
      <Sidebar />
      <motion.main
        animate={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 64 : 232) }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="flex-1 min-h-screen min-w-0"
      >
        {children}
      </motion.main>
    </div>
  )
}
