'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { statementsApi, cardsApi } from '@/lib/api'
import { Statement, CreditCard } from '@/types'
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { FileText, Upload, X, Eye, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_META = {
  PENDING: { label: 'Pending', icon: Clock, color: 'text-muted-foreground', bg: 'bg-white/5' },
  PROCESSING: { label: 'Processing', icon: Loader2, color: 'text-info', bg: 'bg-info/5', spin: true },
  PARSED: { label: 'Parsed', icon: CheckCircle, color: 'text-success', bg: 'bg-success/5' },
  FAILED: { label: 'Failed', icon: AlertCircle, color: 'text-danger', bg: 'bg-danger/5' },
}

export default function StatementsPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadCard, setUploadCard] = useState('')
  const [password, setPassword] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const qc = useQueryClient()

  const { data: statements = [], isLoading } = useQuery<Statement[]>({
    queryKey: ['statements'],
    queryFn: async () => (await statementsApi.list()).data,
    refetchInterval: (data) => {
      const hasProcessing = (data.state.data as Statement[] | undefined)?.some((s) => s.status === 'PROCESSING' || s.status === 'PENDING')
      return hasProcessing ? 3000 : false
    },
  })

  const { data: cards = [] } = useQuery<CreditCard[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setPendingFile(files[0])
      setShowUpload(true)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  })

  const uploadStatement = async () => {
    if (!pendingFile || !uploadCard) {
      toast.error('Please select a card')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('card_id', uploadCard)
      if (password) formData.append('password', password)

      await statementsApi.upload(formData)
      qc.invalidateQueries({ queryKey: ['statements'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Statement uploaded! Parsing in progress…')
      setShowUpload(false)
      setPendingFile(null)
      setPassword('')
      setUploadCard('')
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const parsed = statements.filter((s) => s.status === 'PARSED').length
  const processing = statements.filter((s) => s.status === 'PROCESSING' || s.status === 'PENDING').length

  return (
    <AppShell>
      <div className="p-6 max-w-[1100px] mx-auto">
        <PageHeader
          icon={FileText}
          title="Statements"
          subtitle={`${statements.length} uploaded · ${parsed} parsed · ${processing} processing`}
        />

        {/* Drop Zone */}
        <div {...getRootProps()}
          className={cn(
            'glass-card p-10 text-center cursor-pointer border-2 border-dashed transition-all mb-6',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/3'
          )}>
          <input {...getInputProps()} />
          <motion.div animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}>
            <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
            <h3 className="text-base font-semibold text-foreground">
              {isDragActive ? 'Drop PDF here' : 'Drop your credit card statement'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">PDF format · Password protected supported</p>
            <p className="text-xs text-muted-foreground mt-2">
              HDFC · ICICI · SBI · Axis · Amex · IDFC · OneCard · AU · Kotak · Standard Chartered
            </p>
          </motion.div>
        </div>

        {/* Statements list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 glass-card shimmer-bg" />)}
          </div>
        ) : statements.length > 0 ? (
          <div className="space-y-3">
            {statements.map((stmt) => {
              const card = cards.find((c) => c.id === stmt.card_id)
              const meta = STATUS_META[stmt.status]
              return (
                <motion.div key={stmt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('glass-card p-5 flex items-center gap-4', meta.bg)}>
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{stmt.filename}</span>
                      {stmt.bank_detected && (
                        <span className="text-xs bg-white/10 text-muted-foreground px-2 py-0.5 rounded-full">{stmt.bank_detected}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {card ? `${card.nickname} ···${card.last_four}` : 'Unknown card'} ·
                      {stmt.period_from && stmt.period_to ? ` ${formatDate(stmt.period_from)} – ${formatDate(stmt.period_to)} ·` : ''}
                      {' '}{Number(stmt.transaction_count)} transactions · Uploaded {formatDate(stmt.created_at)}
                    </div>
                  </div>

                  {stmt.status === 'PARSED' && (
                    <div className="text-right text-xs text-muted-foreground hidden md:block">
                      <div>Total Due: <span className="text-foreground font-mono">{formatCurrencyCompact(Number(stmt.total_due))}</span></div>
                      <div>Min Due: <span className="text-foreground font-mono">{formatCurrencyCompact(Number(stmt.minimum_due))}</span></div>
                    </div>
                  )}

                  <div className={cn('flex items-center gap-1.5 text-xs font-medium flex-shrink-0', meta.color)}>
                    <meta.icon className={cn('w-4 h-4', (meta as any).spin && 'animate-spin')} />
                    {meta.label}
                  </div>

                  {stmt.parse_error && (
                    <div className="text-xs text-danger max-w-[200px] truncate" title={stmt.parse_error}>
                      {stmt.parse_error}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="glass-card p-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No statements uploaded</h3>
            <p className="text-muted-foreground text-sm mt-2">Upload your first statement above to auto-parse transactions</p>
          </div>
        )}

        {/* Upload Modal */}
        <AnimatePresence>
          {showUpload && pendingFile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => !uploading && setShowUpload(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-foreground">Configure Upload</h3>
                  {!uploading && <button onClick={() => setShowUpload(false)}><X className="w-5 h-5 text-muted-foreground" /></button>}
                </div>

                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 mb-5 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{pendingFile.name}</div>
                    <div className="text-xs text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credit Card *</label>
                    <select value={uploadCard} onChange={(e) => setUploadCard(e.target.value)}
                      className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                      <option value="">Select card</option>
                      {cards.map((c) => <option key={c.id} value={c.id}>{c.nickname} — {c.bank_name} ···{c.last_four}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      PDF Password <span className="text-muted-foreground/50">(if protected)</span>
                    </label>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                      placeholder="Leave empty if not protected"
                      className="mt-1 w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    <p className="text-xs text-muted-foreground mt-1">Password is used only for decryption and never stored.</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowUpload(false)} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-white/5 disabled:opacity-40">
                    Cancel
                  </button>
                  <button onClick={uploadStatement} disabled={uploading || !uploadCard}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Parse Statement</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
