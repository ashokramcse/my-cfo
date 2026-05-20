'use client'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@/store/ui'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <motion.main
        animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex-1 min-h-screen"
      >
        {children}
      </motion.main>
    </div>
  )
}
