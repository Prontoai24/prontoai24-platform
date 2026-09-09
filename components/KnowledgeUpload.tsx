'use client'

import { FormEvent, useEffect, useState } from 'react'
import { FileText, Link2, Upload } from 'lucide-react'

type Source = { id: string; type: 'url' | 'file'; source_value: string; status: string; error_message?: string | null; created_at: string }

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function KnowledgeUpload() {
  const [sources, setSources] = useState<Source[]>([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    const response = await fetch('/api/client/knowledge/sources', { cache: 'no-store' })
    if (response.ok) setSources((await response.json()).sources || [])
  }
  useEffect(() => { void refresh() }, [])

  async function addUrl(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) return
    setLoading(true); setMessage(null)
    const response = await fetch('/api/client/knowledge/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) })
    const body = await response.json().catch(() => ({}))
    setLoading(false)
    setMessage(response.ok ? (body.duplicate ? body.message : 'URL acquisito e messo in coda.') : (body.error || 'Import URL non riuscito.'))
    if (response.ok) { setUrl(''); await refresh() }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true); setMessage(null)
    try {
      const contentHash = await sha256(file)
      const response = await fetch('/api/client/knowledge/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', fileSize: file.size, contentHash }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Creazione fonte non riuscita.')
      if (body.duplicate) {
        setMessage(body.message || 'Documento già indicizzato.')
        return
      }
      const upload = await fetch(body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!upload.ok) throw new Error('Upload su Cloudflare R2 non riuscito.')
      const complete = await fetch(`/api/client/knowledge/sources/${body.source.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream' }) })
      const completeBody = await complete.json().catch(() => ({}))
      if (!complete.ok) throw new Error(completeBody.error || 'Accodamento non riuscito.')
      setMessage('Documento caricato su R2 e messo in coda.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload non riuscito.')
    } finally {
      setLoading(false); event.target.value = ''; await refresh()
    }
  }

  const statusLabel: Record<string, string> = { pending: 'In attesa', processing: 'Elaborazione', ready: 'Pronta', error: 'Errore' }
  return <div className="mt-5 space-y-4">
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--blue)] hover:border-[var(--cyan)]"><Upload size={16} /> {loading ? 'Elaborazione…' : 'Carica documento'}<input type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={upload} disabled={loading} className="hidden" /></label>
      <form onSubmit={addUrl} className="flex min-w-[min(100%,360px)] flex-1 gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--line)] px-3"><Link2 size={16} className="shrink-0 text-[var(--muted)]" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.tuosito.it" className="min-w-0 flex-1 py-2 text-sm outline-none" aria-label="URL sito da acquisire" /></div><button disabled={loading || !url.trim()} className="rounded-full bg-[var(--blue)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Aggiungi URL</button></form>
    </div>
    {message && <p className="text-xs font-semibold text-[var(--muted)]">{message}</p>}
    <div className="space-y-2">{sources.length === 0 && <p className="text-sm text-[var(--muted)]">Nessuna fonte ancora collegata.</p>}{sources.map((source) => <div key={source.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3"><div className="flex min-w-0 items-center gap-3"><FileText size={17} className="shrink-0 text-[var(--blue)]" /><p className="truncate text-sm font-semibold">{source.source_value}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${source.status === 'ready' ? 'bg-[#e5f8f6] text-[var(--blue)]' : source.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-[#fff0dc] text-[#9b5d00]'}`}>{statusLabel[source.status] || source.status}</span></div>)}</div>
  </div>
}
