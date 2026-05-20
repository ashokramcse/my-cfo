'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Bell } from 'lucide-react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, setUser } = useAuthStore()
  const { sidebarCollapsed } = useUIStore()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
  }, [isAuthenticated, router])

  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      setUser(res.data)
      return res.data
    },
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return null

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
