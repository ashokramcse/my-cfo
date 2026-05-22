import axios from 'axios'

// Empty string = relative URLs (/api/v1/...) → nginx proxies to backend in Docker
// Set NEXT_PUBLIC_API_URL=http://localhost:8000 for local dev without Docker
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Typed API helpers
export const cardsApi = {
  list: () => api.get('/cards'),
  get: (id: string) => api.get(`/cards/${id}`),
  create: (data: unknown) => api.post('/cards', data),
  update: (id: string, data: unknown) => api.patch(`/cards/${id}`, data),
  delete: (id: string) => api.delete(`/cards/${id}`),
  utilization: (id: string) => api.get(`/cards/${id}/utilization`),
}

export const transactionsApi = {
  list: (params?: Record<string, unknown>) => api.get('/transactions', { params }),
  get: (id: string) => api.get(`/transactions/${id}`),
  create: (data: unknown) => api.post('/transactions', data),
  update: (id: string, data: unknown) => api.patch(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
  categoryBreakdown: (params?: Record<string, unknown>) => api.get('/transactions/analytics/category-breakdown', { params }),
  monthlyTrend: (months?: number) => api.get('/transactions/analytics/monthly-trend', { params: { months } }),
}

export const emisApi = {
  list: (params?: Record<string, unknown>) => api.get('/emis', { params }),
  get: (id: string) => api.get(`/emis/${id}`),
  create: (data: unknown) => api.post('/emis', data),
  update: (id: string, data: unknown) => api.patch(`/emis/${id}`, data),
  delete: (id: string) => api.delete(`/emis/${id}`),
  recordPayment: (id: string, params: Record<string, unknown>) => api.post(`/emis/${id}/record-payment`, null, { params }),
  forecast: (months?: number) => api.get('/emis/analytics/forecast', { params: { months_ahead: months } }),
}

export const friendsApi = {
  list: () => api.get('/friends'),
  get: (id: string) => api.get(`/friends/${id}`),
  create: (data: unknown) => api.post('/friends', data),
  update: (id: string, data: unknown) => api.patch(`/friends/${id}`, data),
  delete: (id: string) => api.delete(`/friends/${id}`),
  emis: (id: string) => api.get(`/friends/${id}/emis`),
  intelligence: () => api.get('/friends/analytics/intelligence-dashboard'),
}

export const statementsApi = {
  list: (params?: Record<string, unknown>) => api.get('/statements', { params }),
  get: (id: string) => api.get(`/statements/${id}`),
  upload: (formData: FormData) => api.post('/statements/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  status: (id: string) => api.get(`/statements/${id}/status`),
  delete: (id: string) => api.delete(`/statements/${id}`),
}

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  spending: (params?: Record<string, unknown>) => api.get('/reports/spending', { params }),
}

export const insightsApi = {
  list: (params?: Record<string, unknown>) => api.get('/insights', { params }),
  markRead: (id: string) => api.patch(`/insights/${id}/read`),
  dismiss: (id: string) => api.patch(`/insights/${id}/dismiss`),
  generate: () => api.post('/insights/generate'),
}

// ── Financial OS: New API modules ──────────────────────────────────────────

export const bankAccountsApi = {
  list: () => api.get('/bank-accounts'),
  create: (data: unknown) => api.post('/bank-accounts', data),
  update: (id: string, data: unknown) => api.patch(`/bank-accounts/${id}`, data),
  updateBalance: (id: string, balance: number, notes?: string) =>
    api.patch(`/bank-accounts/${id}/balance`, null, { params: { balance, notes } }),
  delete: (id: string) => api.delete(`/bank-accounts/${id}`),
  cashflow: (months?: number) => api.get('/bank-accounts/analytics/cashflow', { params: { months } }),
  transactions: (id: string, params?: Record<string, unknown>) =>
    api.get(`/bank-accounts/${id}/transactions`, { params }),
  addTransaction: (id: string, data: unknown) =>
    api.post(`/bank-accounts/${id}/transactions`, data),
  importTransactions: (id: string, transactions: unknown[]) =>
    api.post(`/bank-accounts/${id}/transactions/import`, transactions),
}

export const investmentsApi = {
  list: () => api.get('/investments'),
  create: (data: unknown) => api.post('/investments', data),
  update: (id: string, data: unknown) => api.patch(`/investments/${id}`, data),
  delete: (id: string) => api.delete(`/investments/${id}`),
  summary: () => api.get('/investments/analytics/summary'),
  intelligence: () => api.get('/investments/analytics/intelligence'),
}

export const loansApi = {
  list: () => api.get('/loans'),
  create: (data: unknown) => api.post('/loans', data),
  update: (id: string, data: unknown) => api.patch(`/loans/${id}`, data),
  delete: (id: string) => api.delete(`/loans/${id}`),
  summary: () => api.get('/loans/analytics/summary'),
  intelligence: () => api.get('/loans/analytics/intelligence'),
}

export const assetsApi = {
  list: () => api.get('/assets'),
  create: (data: unknown) => api.post('/assets', data),
  update: (id: string, data: unknown) => api.patch(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  intelligence: () => api.get('/assets/analytics/intelligence'),
}

export const incomeApi = {
  sources: () => api.get('/income/sources'),
  createSource: (data: unknown) => api.post('/income/sources', data),
  updateSource: (id: string, data: unknown) => api.patch(`/income/sources/${id}`, data),
  deleteSource: (id: string) => api.delete(`/income/sources/${id}`),
  entries: (params?: Record<string, unknown>) => api.get('/income/entries', { params }),
  createEntry: (data: unknown) => api.post('/income/entries', data),
  deleteEntry: (id: string) => api.delete(`/income/entries/${id}`),
  intelligence: (months?: number) => api.get('/income/analytics/intelligence', { params: { months } }),
}

export const insuranceApi = {
  list: () => api.get('/insurance'),
  create: (data: unknown) => api.post('/insurance', data),
  update: (id: string, data: unknown) => api.patch(`/insurance/${id}`, data),
  delete: (id: string) => api.delete(`/insurance/${id}`),
  intelligence: () => api.get('/insurance/analytics/intelligence'),
}

export const goalsApi = {
  list: () => api.get('/goals'),
  create: (data: unknown) => api.post('/goals', data),
  update: (id: string, data: unknown) => api.patch(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
  contribute: (id: string, amount: number, notes?: string) =>
    api.post(`/goals/${id}/contribute`, { amount, notes }),
  intelligence: () => api.get('/goals/analytics/intelligence'),
}

export const aiCfoApi = {
  chat: (message: string, sessionId?: string, model?: string) =>
    api.post('/ai-cfo/chat', { message, session_id: sessionId, model }),
  history: (limit?: number) => api.get('/ai-cfo/history', { params: { limit } }),
  clearHistory: () => api.delete('/ai-cfo/history'),
}

export const netWorthApi = {
  current: () => api.get('/net-worth/current'),
  intelligence: () => api.get('/net-worth/intelligence'),
  snapshot: () => api.post('/net-worth/snapshot'),
  history: (months?: number) => api.get('/net-worth/history', { params: { months } }),
}
