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
