'use client'
import { AppShell } from '@/components/layout/AppShell'
import { ViewRouter } from '@/components/views/ViewRouter'
import { AuthGate } from '@/components/auth/AuthGate'

export default function DashboardPage() {
  return (
    <AuthGate>
      <AppShell><ViewRouter /></AppShell>
    </AuthGate>
  )
}
