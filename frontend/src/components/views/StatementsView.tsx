'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { statementsApi, cardsApi } from '@/lib/api'
import { Statement, CreditCard } from '@/types'
import { formatCurrencyCompact, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { FileText, Upload, X, CheckCircle, Clock, AlertCircle, Loader2, Image } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import toast from 'react-hot-toast'

const STATUS_CFG = {
  PENDING:    { label: 'Pending',    icon: Clock,        cls: 'badge-neutral', spin: false },
  PROCESSING: { label: 'Processing', icon: Loader2,      cls: 'badge-info',    spin: true  },
  PARSED:     { label: 'Parsed',     icon: CheckCircle,  cls: 'badge-success', spin: false },
  FAILED:     { label: 'Failed',     icon: AlertCircle,  cls: 'badge-danger',  spin: false },
}

export function StatementsView() {
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
    <>
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
      <div className="p-3 sm:p-5 xl:p-6 max-w-[1000px] mx-auto">

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn('cursor-pointer mb-6 transition-all rounded-2xl p-10 text-center')}
          style={{
            border: isDragActive ? '2px dashed #F97316' : '2px dashed #CCC7C0',
            background: isDragActive ? '#FFF7ED' : '#FFFFFF',
          }}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FFF0E6, #FFE4CC)', border: '1.5px solid #FED7AA' }}>
            <Upload className="w-5 h-5" style={{ color: '#F97316' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#18120E' }}>
            {isDragActive ? 'Drop it here!' : 'Drag & drop your statement'}
          </p>
          <p className="text-xs" style={{ color: '#A09890' }}>
            Supports PDF (all major banks) and images (PNG, JPG, WebP — Cred screenshots)
          </p>
        </div>

        {/* Statements list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-[#FFF1E6] shimmer" style={{ backgroundSize: '200% 100%' }} />
            ))}
          </div>
        ) : statements.length ? (
          <div className="card overflow-hidden">
            <div className="table-responsive">
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
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#FFF1E6]">
                            {isImg
                              ? <Image className="w-4 h-4 text-sky-400" />
                              : <FileText className="w-4 h-4 text-orange-500" />
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
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FFF0E0, #FFD9B0)', border: '2px solid #FDC888' }}>
              <FileText className="w-6 h-6" style={{ color: '#EA580C' }} strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: '#18120E' }}>No statements uploaded yet</p>
              <p className="text-xs mt-1" style={{ color: '#A09890' }}>Upload a PDF or screenshot to get started</p>
            </div>
          </div>
        )}

        {/* Upload modal */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(24,18,14,0.55)' }}
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
                    className="w-8 h-8 rounded-xl bg-[#FFF1E6] hover:bg-[#FFE8D6] flex items-center justify-center transition-colors">
                    <X className="w-4 h-4" style={{ color: '#18120E' }} />
                  </button>
                </div>

                {pendingFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF1E6] border border-border mb-5">
                    {isImage
                      ? <Image className="w-5 h-5 text-sky-400 flex-shrink-0" />
                      : <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    }
                    <span className="text-sm text-foreground truncate flex-1">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} className="hover:opacity-70 transition-opacity" style={{ color: '#18120E' }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div {...getRootProps()} className="rounded-xl p-8 text-center cursor-pointer transition-colors mb-5"
                    style={{ border: '2px dashed #CCC7C0', background: '#FFF8F4' }}>
                    <input {...getInputProps()} />
                    <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: '#F97316' }} />
                    <p className="text-sm" style={{ color: '#6B6460' }}>Click or drag file here</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="field-label">Card *</label>
                    <Select
                      value={uploadCard}
                      onChange={setUploadCard}
                      options={[{ value: '', label: 'Select card…' }, ...cards.map((c) => ({ value: c.id, label: `${c.nickname} ···${c.last_four}` }))]}
                    />
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
    </>
  )
}

