'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  icon?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  prefix?: React.ReactNode  // e.g. a search icon or label chip
}

export function Select({ value, onChange, options, placeholder, className, prefix }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-1.5 px-3 h-8 rounded-lg text-[13px] font-medium transition-all',
          'bg-white border border-[#C8C2BB] text-[#18120E]',
          'hover:border-orange-400 hover:shadow-[0_0_0_3px_rgba(249,115,22,0.10)]',
          open && 'border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]',
        )}
        style={{ letterSpacing: '-0.01em' }}
      >
        {prefix && <span className="flex-shrink-0">{prefix}</span>}
        {selected?.icon && <span className="text-sm leading-none">{selected.icon}</span>}
        <span className="flex-1 text-left truncate" style={{ color: selected ? '#18120E' : '#A09890' }}>
          {selected ? selected.label : (placeholder ?? 'Select…')}
        </span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150', open && 'rotate-180')}
          style={{ color: '#A09890' }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[160px] rounded-xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E8E2DB',
            boxShadow: '0 8px 32px rgba(24,18,14,0.13), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="max-h-64 overflow-y-auto py-1 no-scrollbar">
            {options.map((opt) => {
              const active = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left',
                    active
                      ? 'bg-[#FFF1E6] text-[#EA580C] font-semibold'
                      : 'text-[#18120E] hover:bg-[#FAF7F4] font-medium',
                  )}
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {opt.icon && <span className="text-sm leading-none w-4 text-center flex-shrink-0">{opt.icon}</span>}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {active && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F97316' }} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
