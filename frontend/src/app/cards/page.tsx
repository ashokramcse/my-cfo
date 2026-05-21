'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/ui'

// Direct URL access to /cards redirects to /dashboard and activates the cards view
export default function CardsPage() {
  const router = useRouter()
  const setView = useUIStore((s) => s.setView)
  useEffect(() => {
    setView('cards')
    router.replace('/dashboard')
  }, [])
  return null
}
