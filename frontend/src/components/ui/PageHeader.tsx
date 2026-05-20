'use client'
import { LucideIcon, Menu } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useIsMobile } from '@/hooks/useIsMobile'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  const { openMobileSidebar } = useUIStore()
  const isMobile = useIsMobile()

  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4"
      style={{ background: '#FFFFFF', borderBottom: '1.5px solid #D8D2CB', position: 'sticky', top: 0, zIndex: 40 }}>
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {isMobile && (
          <button
            onClick={openMobileSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F5F0EB]"
            style={{ color: '#6B6460' }}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 2px 8px rgba(249,115,22,0.32)' }}>
          <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[13px] md:text-[15px] font-bold leading-tight tracking-tight truncate" style={{ color: '#18120E' }}>{title}</h1>
          {subtitle && (
            <p className="text-[11px] leading-none mt-0.5 truncate hidden sm:block" style={{ color: '#A09890' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 ml-2">{actions}</div>}
    </div>
  )
}
