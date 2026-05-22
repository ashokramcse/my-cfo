import { create } from 'zustand'

export type ViewId =
  | 'dashboard' | 'net-worth' | 'banking' | 'investments' | 'loans' | 'assets'
  | 'income' | 'insurance' | 'goals' | 'ai-cfo'
  | 'cards' | 'transactions' | 'emis'
  | 'friends' | 'statements' | 'reports' | 'settings'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  activeModal: string | null
  openModal: (id: string) => void
  closeModal: () => void
  // SPA view routing — changes content without touching the URL
  currentView: ViewId
  setView: (v: ViewId) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileSidebarOpen: false,
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  currentView: 'dashboard',
  setView: (v) => set({ currentView: v, mobileSidebarOpen: false }),
}))
