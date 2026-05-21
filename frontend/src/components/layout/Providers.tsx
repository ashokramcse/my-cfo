'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { cardsApi, transactionsApi, emisApi, friendsApi, reportsApi, insightsApi, statementsApi } from '@/lib/api'

// Prefetch all pages' primary data as soon as the app loads so every
// navigation feels instant — no skeleton flash on first visit.
function DataPrefetcher({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    // Keys must exactly match what each view's useQuery uses
    queryClient.prefetchQuery({ queryKey: ['dashboard'],                              queryFn: () => reportsApi.dashboard().then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['cards'],                                  queryFn: () => cardsApi.list().then(r => r.data.items) })
    queryClient.prefetchQuery({ queryKey: ['transactions', 1, '', 'ALL', ''],         queryFn: () => transactionsApi.list({ page: 1, page_size: 50 }).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['emis', 'ACTIVE'],                         queryFn: () => emisApi.list({ status: 'ACTIVE' }).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['emi-forecast'],                           queryFn: () => emisApi.forecast(6).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['friends'],                                queryFn: () => friendsApi.list().then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['statements'],                             queryFn: () => statementsApi.list().then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['insights'],                               queryFn: () => insightsApi.list({ unread_only: true, limit: 5 }).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['spending'],                               queryFn: () => reportsApi.spending().then(r => r.data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 5 min stale time — navigating back to a page uses cache instantly
        staleTime: 5 * 60_000,
        // Keep data in memory for 10 min after component unmounts
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <DataPrefetcher queryClient={queryClient} />
      {children}
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 56 }}
        toastOptions={{ style: { padding: 0, background: 'transparent', boxShadow: 'none' } }}
      />
    </QueryClientProvider>
  )
}
