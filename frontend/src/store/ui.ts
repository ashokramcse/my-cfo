import { create } from 'zustand'

export type ViewId =
  | 'dashboard' | 'net-worth' | 'banking' | 'investments' | 'loans' | 'assets'
  | 'income' | 'insurance' | 'goals' | 'ai-cfo'
  | 'cards' | 'transactions' | 'emis'
  | 'friends' | 'statements' | 'reports' | 'settings' | 'sharing'

const VALID_VIEWS = new Set<string>([
  'dashboard', 'net-worth', 'banking', 'investments', 'loans', 'assets',
  'income', 'insurance', 'goals', 'ai-cfo',
  'cards', 'transactions', 'emis',
  'friends', 'statements', 'reports', 'settings', 'sharing',
])

function getInitialView(): ViewId {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1)
    if (hash && VALID_VIEWS.has(hash)) {
      return hash as ViewId
    }
  }
  return 'dashboard'
}

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  activeModal: string | null
  openModal: (id: string) => void
  closeModal: () => void
  // SPA view routing — synced with URL hash for deep linking
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
  currentView: getInitialView(),
  setView: (view) => {
    set({ currentView: view, mobileSidebarOpen: false })
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `#${view}`)
    }
  },
}))
