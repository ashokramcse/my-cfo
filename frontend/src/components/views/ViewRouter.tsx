'use client'
import { useUIStore } from '@/store/ui'
import { DashboardView }   from './DashboardView'
import { CardsView }       from './CardsView'
import { TransactionsView }from './TransactionsView'
import { EMIsView }        from './EMIsView'
import { RecurringView }   from './RecurringView'
import { FriendsView }     from './FriendsView'
import { StatementsView }  from './StatementsView'
import { ReportsView }     from './ReportsView'
import { SettingsView }    from './SettingsView'
import { NetWorthView }    from './NetWorthView'
import { BankingView }     from './BankingView'
import { InvestmentsView } from './InvestmentsView'
import { LoansView }       from './LoansView'
import { AssetsView }      from './AssetsView'
import { IncomeView }      from './IncomeView'
import { InsuranceView }   from './InsuranceView'
import { GoalsView }       from './GoalsView'
import { SharingView }        from './SharingView'
import { VisualizationView }  from './VisualizationView'

export function ViewRouter() {
  const { currentView } = useUIStore()

  switch (currentView) {
    case 'dashboard':    return <DashboardView />
    case 'net-worth':    return <NetWorthView />
    case 'banking':      return <BankingView />
    case 'investments':  return <InvestmentsView />
    case 'loans':        return <LoansView />
    case 'assets':       return <AssetsView />
    case 'income':       return <IncomeView />
    case 'insurance':    return <InsuranceView />
    case 'goals':        return <GoalsView />
    case 'cards':        return <CardsView />
    case 'transactions': return <TransactionsView />
    case 'emis':         return <EMIsView />
    case 'recurring':    return <RecurringView />
    case 'friends':      return <FriendsView />
    case 'statements':   return <StatementsView />
    case 'reports':      return <ReportsView />
    case 'visualize':    return <VisualizationView />
    case 'settings':     return <SettingsView />
    case 'sharing':      return <SharingView />
    default:             return <DashboardView />
  }
}
