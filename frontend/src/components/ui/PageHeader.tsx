import { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 mb-1"
      style={{
        background: '#FFFFFF',
        borderBottom: '1.5px solid #DDD8D2',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            boxShadow: '0 2px 8px rgba(249,115,22,0.32)',
          }}>
          <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-[15px] font-bold leading-tight tracking-tight" style={{ color: '#18120E' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs leading-none mt-0.5" style={{ color: '#A09890' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}
