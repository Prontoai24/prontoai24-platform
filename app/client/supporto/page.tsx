'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

export default function SupportoClient() {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    const response = await fetch('/api/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, description, priority }) })
    const body = await response.json()
    setLoading(false)
    if (!response.ok) return setMessage(body.error || 'Non è stato possibile aprire il ticket.')
    setSubject('')
    setDescription('')
    setMessage('Ticket aperto. Il team ProntoAI24 ti risponderà al più presto.')
  }

  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-2xl"><Link href="/client" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Torna alla dashboard</Link><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Supporto</p><h1 className="mt-3 text-4xl font-bold">Apri un ticket</h1><p className="mt-4 leading-7 text-[var(--muted)]">Descrivi la richiesta: il team potrà seguirla con uno stato e una priorità dedicati.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-bold">Oggetto<input value={subject} onChange={(event) => setSubject(event.target.value)} required className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--cyan)]" /></label><label className="block text-sm font-bold">Priorità<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--cyan)]"><option value="low">Bassa</option><option value="normal">Normale</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label className="block text-sm font-bold">Descrizione<textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={7} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--cyan)]" /></label>{message && <p role="status" className="rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold text-[var(--blue)]">{message}</p>}<button disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 font-bold text-white disabled:opacity-60">{loading ? 'Invio…' : 'Invia ticket'} <Send size={16} /></button></form></div></div></main>
}
