import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'INR'): string {
  const n = Number(amount ?? 0)
  if (!isFinite(n)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatCurrencyCompact(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!isFinite(n)) return '₹0'
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function formatDate(dateStr: string | null, fmt = 'dd MMM yyyy'): string {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), fmt) } catch { return dateStr }
}

export function formatRelativeDate(dateStr: string): string {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }) } catch { return dateStr }
}

export function utilizationColor(pct: number): string {
  if (pct >= 80) return 'text-danger'
  if (pct >= 50) return 'text-warning'
  return 'text-success'
}

export function utilizationBg(pct: number): string {
  if (pct >= 80) return 'bg-danger'
  if (pct >= 50) return 'bg-warning'
  return 'bg-success'
}

export function riskBadge(level: string): string {
  if (level === 'HIGH') return 'badge-risk-high'
  if (level === 'MEDIUM') return 'badge-risk-medium'
  return 'badge-risk-low'
}

export const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  FOOD: { label: 'Food', icon: '🍔', color: '#f97316' },
  DINING: { label: 'Dining', icon: '🍽️', color: '#fb923c' },
  GROCERIES: { label: 'Groceries', icon: '🛒', color: '#84cc16' },
  FUEL: { label: 'Fuel', icon: '⛽', color: '#eab308' },
  SHOPPING: { label: 'Shopping', icon: '🛍️', color: '#ec4899' },
  RENT: { label: 'Rent', icon: '🏠', color: '#8b5cf6' },
  EMI: { label: 'EMI', icon: '📅', color: '#6366f1' },
  TRAVEL: { label: 'Travel', icon: '✈️', color: '#06b6d4' },
  UTILITIES: { label: 'Utilities', icon: '💡', color: '#14b8a6' },
  ENTERTAINMENT: { label: 'Entertainment', icon: '🎬', color: '#f43f5e' },
  INVESTMENT: { label: 'Investment', icon: '📈', color: '#22c55e' },
  HEALTHCARE: { label: 'Healthcare', icon: '🏥', color: '#ef4444' },
  SUBSCRIPTION: { label: 'Subscriptions', icon: '🔄', color: '#a855f7' },
  EDUCATION: { label: 'Education', icon: '📚', color: '#3b82f6' },
  CASH_WITHDRAWAL: { label: 'Cash', icon: '💵', color: '#64748b' },
  TRANSFER: { label: 'Transfer', icon: '↕️', color: '#94a3b8' },
  FEES: { label: 'Fees', icon: '📋', color: '#dc2626' },
  OTHER: { label: 'Other', icon: '📦', color: '#6b7280' },
}

export const BANK_COLORS: Record<string, { from: string; to: string }> = {
  HDFC: { from: '#1a1a2e', to: '#16213e' },
  ICICI: { from: '#1a0a2e', to: '#2d1b4e' },
  SBI: { from: '#0a1628', to: '#1e3a5f' },
  AXIS: { from: '#2d0a0a', to: '#4a1515' },
  AMEX: { from: '#0a2d1e', to: '#155234' },
  DEFAULT: { from: '#1e1b4b', to: '#312e81' },
}
