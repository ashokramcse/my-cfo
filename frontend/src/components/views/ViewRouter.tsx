'use client'
import { useUIStore } from '@/store/ui'
import { DashboardView } from './DashboardView'
import { CardsView } from './CardsView'
import { TransactionsView } from './TransactionsView'
import { EMIsView } from './EMIsView'
import { FriendsView } from './FriendsView'
import { StatementsView } from './StatementsView'
import { ReportsView } from './ReportsView'
import { SettingsView } from './SettingsView'

export function ViewRouter() {
  const { currentView } = useUIStore()

  switch (currentView) {
    case 'dashboard':    return <DashboardView />
    case 'cards':        return <CardsView />
    case 'transactions': return <TransactionsView />
    case 'emis':         return <EMIsView />
    case 'friends':      return <FriendsView />
    case 'statements':   return <StatementsView />
    case 'reports':      return <ReportsView />
    case 'settings':     return <SettingsView />
    default:             return <DashboardView />
  }
}
