'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { statementsApi, cardsApi } from '@/lib/api'
import { Statement, CreditCard } from '@/types'
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { FileText, Upload, X, CheckCircle, Clock, AlertCircle, Loader2, Image } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CFG = {
  PENDING:    { label: 'Pending',    icon: Clock,        cls: 'badge-neutral', spin: false },
  PROCESSING: { label: 'Processing', icon: Loader2,      cls: 'badge-info',    spin: true  },
  PARSED:     { label: 'Parsed',     icon: CheckCircle,  cls: 'badge-success', spin: false },
  FAILED:     { label: 'Failed',     icon: AlertCircle,  cls: 'badge-danger',  spin: false },
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
    refetchInterval: (q) => {
      const list = q.state.data as Statement[] | undefined
      return list?.some((s) => s.status === 'PROCESSING' || s.status === 'PENDING') ? 3000 : false
    },
  })

  const { data: cards = [] } = useQuery<CreditCard[]>({
    queryKey: ['cards'],
    queryFn: async () => (await cardsApi.list()).data.items,
  })

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) { setPendingFile(files[0]); setShowUpload(true) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
    maxFiles: 1,
  })

  const uploadStatement = async () => {
    if (!pendingFile || !uploadCard) { toast.error('Select a card first'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', pendingFile)
      form.append('card_id', uploadCard)
      if (password) form.append('password', password)
      await statementsApi.upload(form)
      qc.invalidateQueries({ queryKey: ['statements'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Statement uploaded! Parsing in progress…')
      setShowUpload(false)
      setPendingFile(null)
      setPassword('')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const isImage = pendingFile?.type.startsWith('image/')

  return (
    <AppShell>
      <div className="p-6 xl:p-8 max-w-[1000px] mx-auto">
        <PageHeader
          icon={FileText}
          title="Statements"
          subtitle={`${statements.length} uploaded`}
          actions={
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <Upload className="w-4 h-4" /> Upload
            </button>
          }
        />

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer mb-6',
            isDragActive
              ? 'border-violet-500/60 bg-violet-500/8'
              : 'border-border hover:border-violet-500/40 hover:bg-white/[0.02]',
          )}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Upload className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {isDragActive ? 'Drop it here!' : 'Drag & drop your statement'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports PDF (all major banks) and images (PNG, JPG, WebP — Cred screenshots)
          </p>
        </div>

        {/* Statements list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : statements.length ? (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Card</th>
                  <th>Period</th>
                  <th className="text-right">Due</th>
                  <th>Transactions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => {
                  const cfg = STATUS_CFG[s.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING
                  const StatusIcon = cfg.icon
                  const card = cards.find((c) => c.id === s.card_id)
                  const isImg = s.filename?.match(/\.(png|jpg|jpeg|webp)$/i)
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5">
                            {isImg
                              ? <Image className="w-4 h-4 text-sky-400" />
                              : <FileText className="w-4 h-4 text-violet-400" />
                            }
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground truncate max-w-[180px]">{s.filename}</div>
                            {s.bank_detected && (
                              <div className="text-xs text-muted-foreground">
                                {s.bank_detected === 'CRED' ? '🟣 Cred Screenshot' : s.bank_detected}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {card ? `${card.bank_name} ···${card.last_four}` : '—'}
                      </td>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">
                        {s.period_from ? `${formatDate(s.period_from, 'dd MMM')} – ${formatDate(s.period_to, 'dd MMM yyyy')}` : '—'}
                      </td>
                      <td className="text-right">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {s.total_due ? formatCurrencyCompact(s.total_due) : '—'}
                        </span>
                      </td>
                      <td className="text-sm text-muted-foreground">{s.transaction_count ?? 0}</td>
                      <td>
                        <span className={cn('inline-flex items-center gap-1.5', cfg.cls)}>
                          <StatusIcon className={cn('w-3 h-3', cfg.spin && 'animate-spin')} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No statements uploaded yet</p>
          </div>
        )}

        {/* Upload modal */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => { setShowUpload(false); setPendingFile(null) }}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="card p-6 w-full max-w-md"
                style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Upload Statement</h2>
                  <button onClick={() => { setShowUpload(false); setPendingFile(null) }}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {pendingFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border mb-5">
                    {isImage
                      ? <Image className="w-5 h-5 text-sky-400 flex-shrink-0" />
                      : <FileText className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    }
                    <span className="text-sm text-foreground truncate flex-1">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div {...getRootProps()} className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-violet-500/40 transition-colors mb-5">
                    <input {...getInputProps()} />
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click or drag file here</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="field-label">Card *</label>
                    <select value={uploadCard} onChange={(e) => setUploadCard(e.target.value)}>
                      <option value="">Select card…</option>
                      {cards.map((c) => <option key={c.id} value={c.id}>{c.nickname} ···{c.last_four}</option>)}
                    </select>
                  </div>

                  {pendingFile && !isImage && (
                    <div>
                      <label className="field-label">PDF Password (if protected)</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank if none" />
                    </div>
                  )}

                  <button
                    onClick={uploadStatement}
                    disabled={uploading || !pendingFile || !uploadCard}
                    className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload & Parse</>}
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
