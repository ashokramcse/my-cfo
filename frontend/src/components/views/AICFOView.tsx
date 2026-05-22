'use client'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { aiCfoApi } from '@/lib/api'
import { formatCurrencyCompact } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Send, Bot, User, Trash2, Zap, Sparkles,
  TrendingUp, Landmark, BarChart3, Target, Shield, DollarSign,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import type { AIChatResponse } from '@/types'

// ─── Suggested questions ──────────────────────────────────────────────────────
const SUGGESTED = [
  { icon: TrendingUp,  text: "What is my current net worth?" },
  { icon: Landmark,    text: "How much debt do I have and is my EMI burden healthy?" },
  { icon: BarChart3,   text: "How is my investment portfolio performing?" },
  { icon: Target,      text: "Am I on track to meet my financial goals?" },
  { icon: Shield,      text: "Do I have any insurance coverage gaps?" },
  { icon: DollarSign,  text: "What is my monthly income vs expenses?" },
]

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
function MessageContent({ content }: { content: string }) {
  // Bold: **text** → <strong>
  const rendered = content
    .split('\n')
    .map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
              : part
          )}
          {i < content.split('\n').length - 1 && <br />}
        </span>
      )
    })
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{rendered}</p>
}

// ─── Quick context panel ──────────────────────────────────────────────────────
function ContextPanel({ ctx }: { ctx: AIChatResponse['context'] | null }) {
  if (!ctx) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Financial Snapshot</p>
      {[
        { label: 'Net Worth',    val: ctx.net_worth },
        { label: 'Cash',        val: ctx.banking.total_balance },
        { label: 'Investments', val: ctx.investments.current_value },
        { label: 'Debt',        val: ctx.loans.total_outstanding },
      ].map(({ label, val }) => (
        <div key={label} className="flex justify-between text-xs">
          <span className="text-amber-600">{label}</span>
          <span className="font-semibold text-amber-900">{formatCurrencyCompact(val)}</span>
        </div>
      ))}
      <div className="flex justify-between text-xs border-t border-amber-200 pt-1">
        <span className="text-amber-600">EMI Burden</span>
        <span className={cn('font-semibold',
          ctx.emi_burden.status === 'CRITICAL' ? 'text-red-600' :
          ctx.emi_burden.status === 'WARNING'  ? 'text-amber-600' : 'text-emerald-700')}>
          {ctx.emi_burden.pct_of_income}% [{ctx.emi_burden.status}]
        </span>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-4 py-3">
      {[0,1,2].map(i => (
        <motion.div key={i} className="w-2 h-2 rounded-full bg-amber-400"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  )
}

export function AICFOView() {
  const setView = useUIStore(s => s.setView)
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; model?: string }[]>([])
  const [lastCtx, setLastCtx] = useState<AIChatResponse['context'] | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const chatMut = useMutation({
    mutationFn: (msg: string) => aiCfoApi.chat(msg, sessionId).then(r => r.data as AIChatResponse),
    onMutate: (msg) => {
      setMessages(p => [...p, { role: 'user', content: msg }])
      setIsTyping(true)
      setInput('')
    },
    onSuccess: (data) => {
      setIsTyping(false)
      setSessionId(data.session_id)
      setLastCtx(data.context)
      setMessages(p => [...p, { role: 'assistant', content: data.response, model: data.model }])
    },
    onError: () => {
      setIsTyping(false)
      setMessages(p => [...p, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    },
  })

  const clearMut = useMutation({
    mutationFn: () => aiCfoApi.clearHistory(),
    onSuccess: () => {
      setMessages([])
      setSessionId(undefined)
      setLastCtx(null)
    },
  })

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatMut.isPending) return
    chatMut.mutate(msg)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 80px)' }}>
      <PageHeader icon={Sparkles} title="AI CFO"
        subtitle="Your personal financial advisor powered by local AI"
        actions={
          messages.length > 0 ? (
            <button onClick={() => clearMut.mutate()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-amber-700 border border-amber-200 hover:bg-amber-50">
              <Trash2 size={14} /> Clear
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* ── Chat panel ── */}
        <div className="flex-1 flex flex-col rounded-2xl border border-amber-200 bg-white overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 space-y-6">
                {/* AI avatar */}
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: 'linear-gradient(135deg,#1A0F0A,#2D1810)' }}>
                  <Sparkles size={36} className="text-amber-400" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold text-amber-900 mb-2">FinOS AI — Your Personal CFO</h2>
                  <p className="text-sm text-amber-600 max-w-sm leading-relaxed">
                    Ask me anything about your finances — net worth, debt, investments, goals, insurance, or cash flow.
                    I have full context of your financial life.
                  </p>
                </div>
                {/* Suggested questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTED.map(({ icon: Icon, text }) => (
                    <motion.button
                      key={text}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onClick={() => chatMut.mutate(text)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-left transition-all group">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
                        <Icon size={13} className="text-white" />
                      </div>
                      <span className="text-xs text-amber-800 group-hover:text-amber-900 leading-snug">{text}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                      msg.role === 'user'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gradient-to-br from-amber-900 to-orange-950 text-amber-300')}>
                      {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                    </div>
                    {/* Bubble */}
                    <div className={cn('max-w-[78%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-amber-600 text-white rounded-tr-sm'
                        : 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm')}>
                      <MessageContent content={msg.content} />
                      {msg.model && msg.role === 'assistant' && (
                        <p className="text-[10px] text-amber-400 mt-1.5">via {msg.model}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-900 to-orange-950 flex-shrink-0">
                      <Sparkles size={14} className="text-amber-300" />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-amber-100 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask your CFO anything…"
                rows={1}
                className="flex-1 resize-none border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50/40"
                style={{ maxHeight: 120, overflowY: 'auto' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMut.isPending}
                className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                  input.trim() && !chatMut.isPending
                    ? 'text-white shadow-md hover:shadow-lg active:scale-95'
                    : 'bg-amber-100 text-amber-400 cursor-not-allowed')}
                style={input.trim() && !chatMut.isPending
                  ? { background: 'linear-gradient(135deg,#F97316,#EA580C)' } : {}}>
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-amber-400 mt-2 text-center">
              Powered by Ollama (local AI) · Your data never leaves your server
            </p>
          </div>
        </div>

        {/* ── Context sidebar (desktop) ── */}
        <div className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0">
          {/* Context snapshot */}
          <ContextPanel ctx={lastCtx} />

          {/* Quick nav */}
          <div className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">Quick Navigation</p>
            <div className="space-y-1">
              {[
                { icon: TrendingUp, label: 'Net Worth',   view: 'net-worth'   as const },
                { icon: Landmark,   label: 'Banking',     view: 'banking'     as const },
                { icon: BarChart3,  label: 'Investments', view: 'investments' as const },
                { icon: Landmark,   label: 'Loans',       view: 'loans'       as const },
                { icon: Target,     label: 'Goals',       view: 'goals'       as const },
                { icon: Shield,     label: 'Insurance',   view: 'insurance'   as const },
                { icon: DollarSign, label: 'Income',      view: 'income'      as const },
              ].map(({ icon: Icon, label, view }) => (
                <button key={view} onClick={() => setView(view)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-50 text-left group transition-all">
                  <Icon size={13} className="text-amber-500 group-hover:text-amber-700" />
                  <span className="text-xs text-amber-700 group-hover:text-amber-900">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">💡 Try asking</p>
            <div className="space-y-1">
              {[
                "How's my emergency fund?",
                "Which loan to pay first?",
                "Am I saving enough?",
                "What's my debt-to-income?",
              ].map(q => (
                <button key={q} onClick={() => chatMut.mutate(q)}
                  className="w-full text-left text-xs text-amber-600 hover:text-amber-900 py-1 leading-snug transition-colors">
                  › {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
