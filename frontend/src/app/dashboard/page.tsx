'use client'
import { AppShell } from '@/components/layout/AppShell'
import { ViewRouter } from '@/components/views/ViewRouter'

// SPA entry point — all navigation happens via Zustand state (no URL changes)
export default function DashboardPage() {
  return <AppShell><ViewRouter /></AppShell>
}
