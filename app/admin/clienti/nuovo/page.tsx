'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

export default function NuovoCliente() {
  const [plans, setPlans] = useState<any[]>([])
  const [form, setForm] = useState({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '', planId: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/admin/plans').then((r) => r.json()).then((body) => setPlans(body.plans || [])) }, [])
  function update(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })) }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage(null)
    const response = await fetch('/api/admin/clienti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, sendInvite: true }) })
    const body = await response.json(); setLoading(false)
    setMessage(response.ok ? 'Cliente creato e credenziali inviate via email.' : (body.error || 'Errore nella creazione del cliente.'))
    if (response.ok) setForm({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '', planId: '' })
  }

  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-2xl"><Link href="/admin/clienti" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Clienti</Link><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Nuova anagrafica</p><h1 className="mt-3 text-4xl font-bold">Crea cliente</h1><p className="mt-4 leading-7 text-[var(--muted)]">Crea il profilo operativo, assegna il piano e invia le credenziali temporanee.</p><form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold sm:col-span-2">Azienda<input required value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Partita IVA<input value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Telefono<input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Email referente<input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Piano<select value={form.planId} onChange={(e) => update('planId', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3"><option value="">Da assegnare successivamente</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.minutes_package} minuti</option>)}</select></label>{message && <p className="rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold sm:col-span-2">{message}</p>}<button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 font-bold text-white sm:col-span-2">{loading ? 'Creazione…' : 'Crea e invia credenziali'} <Send size={16} /></button></form></div></div></main>
}
