'use client'
/**
 * Branded toast — wraps react-hot-toast with brand styling.
 * Import `toast` from here instead of 'react-hot-toast' everywhere.
 */
import _toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const BASE = {
  style: {
    padding: 0,
    background: 'transparent',
    boxShadow: 'none',
    maxWidth: '360px',
  },
  duration: 4000,
}

function ToastBody({
  t,
  icon: Icon,
  iconColor,
  iconBg,
  borderColor,
  title,
  message,
}: {
  t: any
  icon: React.ElementType
  iconColor: string
  iconBg: string
  borderColor: string
  title: string
  message?: string
}) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl w-full"
      style={{
        background: '#FFFFFF',
        border: `1.5px solid ${borderColor}`,
        boxShadow: '0 8px 32px rgba(24,18,14,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: iconBg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} strokeWidth={2.2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: '#18120E', letterSpacing: '-0.01em' }}>
          {title}
        </p>
        {message && (
          <p className="text-[12px] mt-0.5 leading-snug" style={{ color: '#6B6460' }}>
            {message}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => _toast.dismiss(t.id)}
        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center hover:bg-[#F5F0EB] transition-colors mt-0.5"
      >
        <X className="w-3 h-3" style={{ color: '#A09890' }} />
      </button>
    </div>
  )
}

export const toast = {
  success: (title: string, message?: string) =>
    _toast.custom(
      (t) => (
        <ToastBody t={t} icon={CheckCircle} iconColor="#15803D" iconBg="#DCFCE7"
          borderColor="#BBF7D0" title={title} message={message} />
      ),
      BASE,
    ),

  error: (title: string, message?: string) =>
    _toast.custom(
      (t) => (
        <ToastBody t={t} icon={XCircle} iconColor="#B91C1C" iconBg="#FEE2E2"
          borderColor="#FECACA" title={title} message={message} />
      ),
      BASE,
    ),

  warning: (title: string, message?: string) =>
    _toast.custom(
      (t) => (
        <ToastBody t={t} icon={AlertTriangle} iconColor="#B45309" iconBg="#FEF3C7"
          borderColor="#FDE68A" title={title} message={message} />
      ),
      BASE,
    ),

  info: (title: string, message?: string) =>
    _toast.custom(
      (t) => (
        <ToastBody t={t} icon={Info} iconColor="#1D4ED8" iconBg="#DBEAFE"
          borderColor="#BFDBFE" title={title} message={message} />
      ),
      BASE,
    ),
}
