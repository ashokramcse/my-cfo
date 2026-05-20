'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { transactionsApi, cardsApi } from '@/lib/api'
import { Transaction, CreditCard, CategoryType } from '@/types'
import { formatCurrency, formatDate, CATEGORY_META } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, Search, Filter, Download, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'

const TX_TYPE_COLORS: Record<string, string> = {
  PURCHASE: 'text-foreground',
  PAYMENT: 'text-success',
  EMI: 'text-primary',
  CASH_ADVANCE: 'text-warning',
  REFUND: 'text-success',
  FEE: 'text-danger',
  INTEREST: 'text-danger',
  OTHER: 'text-muted-foreground',
}

const CATEGORIES = ['ALL', 'FOOD', 'DINING', 'GROCERIES', 'FUEL', 'SHOPPING', 'TRAVEL', 'UTILITIES', 'ENTERTAINMENT', 'INVESTMENT', 'HEALTHCARE', 'SUBSCRIPTION', 'EDUCATION', 'EMI', 'OTHER']

export default function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [cardId, setCardId] = useState('')
  const [txType, setTxType] = useState('')
  const pageSize = 50

  const { data: cards = [] } = useQuery<CreditCard[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, search, category, cardId, txType],
    queryFn: async () => (await transactionsApi.list({
      page, page_size: pageSize,
      search: search || undefined,
      category: category !== 'ALL' ? category : undefined,
      card_id: cardId || undefined,
      transaction_type: txType || undefined,
    })).data,
    placeholderData: (prev) => prev,
  })

  const transactions: Transaction[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)
  const totalAmount = data?.total_amount ?? 0

  return (
    <AppShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHeader
          icon={ArrowLeftRight}
          title="Transactions"
          subtitle={`${total.toLocaleString()} transactions · ${formatCurrency(Number(totalAmount))} total`}
          actions={
            <button className="flex items-center gap-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-sm px-3 py-2 rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4 mb-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchant, description…"
              className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-xl text-sm text-foreground outline-none focus:border-primary" />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : CATEGORY_META[c]?.label ?? c}</option>)}
          </select>
          <select value={cardId} onChange={(e) => { setCardId(e.target.value); setPage(1) }}
            className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="">All Cards</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.nickname} ···{c.last_four}</option>)}
          </select>
          <select value={txType} onChange={(e) => { setTxType(e.target.value); setPage(1) }}
            className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="">All Types</option>
            {['PURCHASE', 'PAYMENT', 'EMI', 'REFUND', 'FEE', 'INTEREST'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.slice(0, 10).map((c) => {
            const meta = c !== 'ALL' ? CATEGORY_META[c] : null
            return (
              <button key={c} onClick={() => { setCategory(c); setPage(1) }}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                  category === c ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10')}>
                {meta?.icon && <span>{meta.icon}</span>}
                {meta?.label ?? 'All'}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Merchant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Card</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Flags</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-white/5 rounded shimmer-bg" /></td>
                    ))}
                  </tr>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => {
                  const meta = CATEGORY_META[tx.category] ?? CATEGORY_META.OTHER
                  const card = cards.find((c) => c.id === tx.card_id)
                  return (
                    <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-border/30 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {formatDate(tx.transaction_date, 'dd MMM')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground truncate max-w-[200px]">
                          {tx.merchant_name || tx.description}
                        </div>
                        {tx.merchant_name && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 flex items-center gap-1 w-fit">
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', TX_TYPE_COLORS[tx.transaction_type] ?? 'text-muted-foreground')}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {card ? `${card.bank_name} ···${card.last_four}` : '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right text-sm font-mono font-semibold',
                        tx.transaction_type === 'PAYMENT' || tx.transaction_type === 'REFUND' ? 'text-success' : 'text-foreground')}>
                        {tx.transaction_type === 'PAYMENT' || tx.transaction_type === 'REFUND' ? '+' : ''}
                        {formatCurrency(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1 justify-center">
                          {tx.is_emi && <span title="EMI" className="text-xs">📅</span>}
                          {tx.is_recurring && <RefreshCw className="w-3 h-3 text-muted-foreground" title="Recurring" />}
                          {tx.is_suspicious && <AlertTriangle className="w-3 h-3 text-warning" title="Suspicious" />}
                          {tx.is_duplicate && <span title="Possible duplicate" className="text-xs text-warning">⚠️</span>}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} total
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-xl border border-border disabled:opacity-40 hover:bg-white/5 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-xl border border-border disabled:opacity-40 hover:bg-white/5 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
