'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { transactionsApi, cardsApi } from '@/lib/api'
import { Transaction, CreditCard } from '@/types'
import { formatCurrency, formatDate, CATEGORY_META } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, Search, ChevronLeft, ChevronRight, AlertTriangle, Receipt } from 'lucide-react'
import { Select, SelectOption } from '@/components/ui/Select'

const TX_COLOR: Record<string, string> = {
  PURCHASE: '#1C1410',
  PAYMENT: '#16A34A',
  EMI: '#F97316',
  CASH_ADVANCE: '#D97706',
  REFUND: '#16A34A',
  FEE: '#DC2626',
  INTEREST: '#DC2626',
  OTHER: '#78716C',
}

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Categories' },
  ...['FOOD','DINING','GROCERIES','FUEL','SHOPPING','TRAVEL','UTILITIES','ENTERTAINMENT','INVESTMENT','HEALTHCARE','SUBSCRIPTION','EDUCATION','EMI','OTHER'].map((c) => ({
    value: c,
    label: CATEGORY_META[c]?.label ?? c,
    icon: CATEGORY_META[c]?.icon,
  })),
]

export function TransactionsView() {
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
    <>
      <PageHeader
          icon={ArrowLeftRight}
          title="Transactions"
          subtitle={`${total.toLocaleString('en-IN')} transactions · ${formatCurrency(Number(totalAmount))} total`}
        />
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1400px] mx-auto">

        {/* Filters — compact single row */}
        <div className="flex items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#A09890' }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchant…"
              className="w-full pl-8 !py-1.5 !text-[13px] !rounded-lg !border-[#C8C2BB]"
              style={{ height: '32px' }}
            />
          </div>
          {/* Category */}
          <Select
            value={category}
            onChange={(v) => { setCategory(v); setPage(1) }}
            options={CATEGORY_OPTIONS}
            className="w-[160px]"
          />
          {/* Card */}
          <Select
            value={cardId}
            onChange={(v) => { setCardId(v); setPage(1) }}
            options={[
              { value: '', label: 'All Cards' },
              ...cards.map((c) => ({ value: c.id, label: `${c.bank_name} ···${c.last_four}` })),
            ]}
            className="w-[160px]"
          />
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
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: '#FFF1E6' }}>
                            <span>{meta.icon}</span>
                            <span className="text-muted-foreground">{meta.label}</span>
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {card ? `${card.bank_name} ···${card.last_four}` : '—'}
                        </td>
                        <td className="text-right">
                          <span className="font-mono text-sm font-semibold" style={{ color: TX_COLOR[tx.transaction_type] ?? '#1C1410' }}>
                            {tx.transaction_type === 'PAYMENT' || tx.transaction_type === 'REFUND' ? '+' : ''}
                            {formatCurrency(Number(tx.amount))}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs px-2 py-0.5 rounded-md" style={{ color: '#78716C', background: '#F5F0EB' }}>
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
                              <span title="Recurring" className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#F97316', background: '#FFEDD5' }}>R</span>
                            )}
                            {tx.is_emi && (
                              <span title="EMI" className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#2563EB', background: '#DBEAFE' }}>EMI</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
                {!isLoading && !transactions.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                          style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '2px solid #FDC888' }}>
                          <Receipt className="w-5 h-5" style={{ color: '#EA580C' }} strokeWidth={1.8} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#18120E' }}>No transactions found</p>
                        <p className="text-xs" style={{ color: '#A09890' }}>Upload a statement or add transactions manually</p>
                      </div>
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
    </>
  )
}

