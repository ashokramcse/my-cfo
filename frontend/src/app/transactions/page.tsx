'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/ui'

// Direct URL access redirects to /dashboard and activates the correct view
export default function Page() {
  const router = useRouter()
  const setView = useUIStore((s) => s.setView)
  useEffect(() => {
    setView('transactions')
    router.replace('/dashboard')
  }, [])
  return null
}
