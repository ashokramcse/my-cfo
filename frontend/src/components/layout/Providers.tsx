'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { cardsApi, transactionsApi, emisApi, friendsApi, reportsApi, insightsApi, statementsApi } from '@/lib/api'

// Prefetch all pages' primary data as soon as the app loads so every
// navigation feels instant — no skeleton flash on first visit.
function DataPrefetcher({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    queryClient.prefetchQuery({ queryKey: ['dashboard'],      queryFn: () => reportsApi.dashboard().then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['cards'],          queryFn: () => cardsApi.list().then(r => r.data.items) })
    queryClient.prefetchQuery({ queryKey: ['transactions'],   queryFn: () => transactionsApi.list({ limit: 50 }).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['emis'],           queryFn: () => emisApi.list({}).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['emi-forecast'],   queryFn: () => emisApi.forecast(6).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['friends'],        queryFn: () => friendsApi.list().then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['statements'],     queryFn: () => statementsApi.list({}).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['insights'],       queryFn: () => insightsApi.list({ limit: 10 }).then(r => r.data) })
    queryClient.prefetchQuery({ queryKey: ['spending'],       queryFn: () => reportsApi.spending().then(r => r.data) })
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
        toastOptions={{
          style: {
            background: 'hsl(224 71% 6%)',
            color: 'hsl(213 31% 91%)',
            border: '1px solid hsl(216 34% 17%)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
