'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { transactionsApi, cardsApi } from '@/lib/api'
import { Transaction, CreditCard } from '@/types'
import { formatCurrency, formatDate, CATEGORY_META } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

const TX_COLOR: Record<string, string> = {
  PURCHASE: 'text-foreground',
  PAYMENT: 'text-emerald-400',
  EMI: 'text-violet-400',
  CASH_ADVANCE: 'text-amber-400',
  REFUND: 'text-emerald-400',
  FEE: 'text-rose-400',
  INTEREST: 'text-rose-400',
  OTHER: 'text-muted-foreground',
}

const CATEGORIES = ['ALL', 'FOOD', 'DINING', 'GROCERIES', 'FUEL', 'SHOPPING', 'TRAVEL', 'UTILITIES', 'ENTERTAINMENT', 'INVESTMENT', 'HEALTHCARE', 'SUBSCRIPTION', 'EDUCATION', 'EMI', 'OTHER']

export default function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [cardId, setCardId] = useState('')
  const pageSize = 50

  const { data: cards = [] } = useQuery<CreditCard[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, search, category, cardId],
    queryFn: async () => (await transactionsApi.list({
      page, page_size: pageSize,
      search: search || undefined,
      category: category !== 'ALL' ? category : undefined,
      card_id: cardId || undefined,
    })).data,
    placeholderData: (prev) => prev,
  })

  const transactions: Transaction[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)
  const totalAmount = data?.total_amount ?? 0

  return (
    <AppShell>
      <div className="p-6 xl:p-8 max-w-[1400px] mx-auto">
        <PageHeader
          icon={ArrowLeftRight}
          title="Transactions"
          subtitle={`${total.toLocaleString('en-IN')} transactions · ${formatCurrency(Number(totalAmount))} total`}
        />

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchant, description…"
              className="w-full pl-9"
            />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="min-w-[160px]">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : (CATEGORY_META[c]?.icon ?? '') + ' ' + (CATEGORY_META[c]?.label ?? c)}</option>
            ))}
          </select>
          <select value={cardId} onChange={(e) => { setCardId(e.target.value); setPage(1) }} className="min-w-[160px]">
            <option value="">All Cards</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.nickname} ···{c.last_four}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Card</th>
                  <th className="text-right">Amount</th>
                  <th>Type</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                  : transactions.map((tx) => {
                    const meta = CATEGORY_META[tx.category] ?? CATEGORY_META.OTHER
                    const card = cards.find((c) => c.id === tx.card_id)
                    return (
                      <tr key={tx.id}>
                        <td className="text-muted-foreground text-xs whitespace-nowrap font-mono">
                          {formatDate(tx.transaction_date, 'dd MMM')}
                        </td>
                        <td>
                          <div className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {tx.merchant_name || tx.description}
                          </div>
                          {tx.merchant_name && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description}</div>
                          )}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5">
                            <span>{meta.icon}</span>
                            <span className="text-muted-foreground">{meta.label}</span>
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {card ? `${card.bank_name} ···${card.last_four}` : '—'}
                        </td>
                        <td className="text-right">
                          <span className={cn('font-mono text-sm font-semibold', TX_COLOR[tx.transaction_type] ?? 'text-foreground')}>
                            {tx.transaction_type === 'PAYMENT' || tx.transaction_type === 'REFUND' ? '+' : ''}
                            {formatCurrency(Number(tx.amount))}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md">
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {tx.is_suspicious && (
                              <span title="Suspicious" className="text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {tx.is_recurring && (
                              <span title="Recurring" className="text-xs text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">R</span>
                            )}
                            {tx.is_emi && (
                              <span title="EMI" className="text-xs text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">EMI</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
                {!isLoading && !transactions.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total.toLocaleString('en-IN')} rows
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn-ghost px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="btn-ghost px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
