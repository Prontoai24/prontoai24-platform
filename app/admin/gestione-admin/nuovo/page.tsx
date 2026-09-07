'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, UserPlus } from 'lucide-react'

export default function NuovoAdmin() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setMessage(null); const response = await fetch('/api/inviti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fullName, role: 'admin' }) }); const body = await response.json(); setLoading(false); setMessage(response.ok ? 'Invito inviato tramite Resend.' : (body.error || 'Invio non riuscito.')); if (response.ok) { setEmail(''); setFullName('') } }
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-xl"><Link href="/admin/gestione-admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Gestione Admin</Link><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10"><UserPlus className="text-[var(--blue)]" size={25} /><h1 className="mt-5 text-4xl font-bold">Invita Admin</h1><p className="mt-4 leading-7 text-[var(--muted)]">Verrà generata una password temporanea e l’utente dovrà cambiarla al primo accesso.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-bold">Nome completo<input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="block text-sm font-bold">Email aziendale<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label>{message && <p className="rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold">{message}</p>}<button disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 font-bold text-white">{loading ? 'Invio…' : 'Invia invito'} <UserPlus size={16} /></button></form></div></div></main>
}
