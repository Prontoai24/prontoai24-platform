'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'

export default function KnowledgeUpload() {
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return; setLoading(true); setMessage(null); const form = new FormData(); form.append('file', file); const response = await fetch('/api/client/knowledge', { method: 'POST', body: form }); const body = await response.json(); setLoading(false); setMessage(response.ok ? 'Documento caricato e messo in coda per l’elaborazione.' : (body.error || 'Upload non riuscito.')); event.target.value = ''
  }
  return <div className="mt-5"><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--blue)] hover:border-[var(--cyan)]"><Upload size={16} /> {loading ? 'Caricamento…' : 'Carica documento'}<input type="file" accept=".pdf,.txt,.doc,.docx,.csv" onChange={upload} disabled={loading} className="hidden" /></label>{message && <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{message}</p>}</div>
}
