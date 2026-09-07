'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Send } from 'lucide-react'

const MINUTES = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]
const TIERS = [
  { key: 'base', name: 'Base', text: 'Per iniziare a portare l’AI nei processi quotidiani.', accent: 'bg-[#e5f8f6]' },
  { key: 'evoluto', name: 'Evoluto', text: 'Per team che vogliono automazioni e assistenti più avanzati.', accent: 'bg-[#eaf0ff]' },
  { key: 'enterprise', name: 'Enterprise', text: 'Per organizzazioni con esigenze estese e flussi su misura.', accent: 'bg-[#f2f8d8]' },
]

type CatalogItem = { plan_type: string; included_minutes: number; billing_cycle: string; price_cents: number }

export default function NuovoCliente() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [minutesIndex, setMinutesIndex] = useState(2)
  const [billingCycle, setBillingCycle] = useState<'trimestrale' | 'annuale'>('annuale')
  const [planType, setPlanType] = useState('evoluto')
  const [form, setForm] = useState({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const includedMinutes = MINUTES[minutesIndex]

  useEffect(() => {
    let mounted = true

    async function loadCatalog() {
      try {
        const response = await fetch('/api/admin/plans', { cache: 'no-store' })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Impossibile aggiornare il listino.')
        if (mounted) {
          setCatalog(body.catalog || [])
          setCatalogError(null)
        }
      } catch (error) {
        if (mounted) setCatalogError(error instanceof Error ? error.message : 'Impossibile aggiornare il listino.')
      }
    }

    const refresh = () => { void loadCatalog() }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'pricing-catalog-updated') refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    void loadCatalog()
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(refresh, 15000)
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pricing-catalog') : null
    channel?.addEventListener('message', refresh)

    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
      channel?.close()
    }
  }, [])

  const prices = useMemo(() => Object.fromEntries(TIERS.map((tier) => {
    const item = catalog.find((entry) => entry.plan_type === tier.key && entry.included_minutes === includedMinutes && entry.billing_cycle === billingCycle)
    return [tier.key, item ? item.price_cents / 100 : 0]
  })), [catalog, includedMinutes, billingCycle])

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, planType, includedMinutes, billingCycle, monthlyPrice: prices[planType], sendInvite: true }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Errore nella creazione del cliente.')
      setMessage('Cliente creato, piano assegnato e credenziali inviate via email.')
      setForm({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Errore nella creazione del cliente.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-5xl"><Link href="/admin/clienti" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Clienti</Link><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Nuova anagrafica</p><h1 className="mt-3 text-4xl font-bold">Crea cliente</h1><p className="mt-4 leading-7 text-[var(--muted)]">Definisci il pacchetto operativo e invia le credenziali temporanee.</p><form onSubmit={submit} className="mt-8 grid gap-6"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold sm:col-span-2">Azienda<input required value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Partita IVA<input value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Telefono<input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Email referente<input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label></div><div className="rounded-3xl border border-[var(--line)] bg-[#f7fbff] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--blue)]">Configurazione piano</p><h2 className="mt-2 text-2xl font-bold">Scegli il pacchetto</h2></div><div className="flex rounded-full border border-[var(--line)] bg-white p-1 text-sm font-bold"><button type="button" onClick={() => setBillingCycle('trimestrale')} className={`rounded-full px-4 py-2 ${billingCycle === 'trimestrale' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}>Trimestrale</button><button type="button" onClick={() => setBillingCycle('annuale')} className={`rounded-full px-4 py-2 ${billingCycle === 'annuale' ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}>Annuale <span className="ml-1 text-[var(--lime)]">-20%</span></button></div></div><label className="mt-7 block text-sm font-bold">Minuti inclusi: <span className="text-[var(--blue)]">{includedMinutes.toLocaleString('it-IT')} min/mese</span><input type="range" min="0" max={MINUTES.length - 1} step="1" value={minutesIndex} onChange={(e) => setMinutesIndex(Number(e.target.value))} className="mt-4 w-full accent-[#0b6e9e]" /><span className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--muted)]"><span>150</span><span>300</span><span>500</span><span>1k</span><span>2k</span><span>4k</span><span>7k</span><span>10k</span></span></label><div className="mt-7 grid gap-4 md:grid-cols-3">{TIERS.map((tier) => <button type="button" key={tier.key} onClick={() => setPlanType(tier.key)} className={`text-left rounded-3xl border-2 p-5 transition ${planType === tier.key ? 'border-[var(--blue)] bg-white shadow-lg shadow-[#0b6e9e]/10' : 'border-transparent bg-white/70 hover:border-[var(--line)]'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tier.accent}`}><Check size={18} className={planType === tier.key ? 'text-[var(--blue)]' : 'text-[var(--muted)]'} /></span><h3 className="mt-5 text-xl font-bold">{tier.name}</h3><p className="mt-2 min-h-[66px] text-sm leading-6 text-[var(--muted)]">{tier.text}</p><p className="mt-5 text-2xl font-bold">{prices[tier.key] ? `€${prices[tier.key].toFixed(2)}` : '—'}<span className="text-sm font-medium text-[var(--muted)]"> / mese</span></p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{billingCycle === 'annuale' ? 'Fatturazione annuale' : 'Fatturazione trimestrale'}</p></button>)}</div>{catalogError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">{catalogError}</p>}{!catalog.length && !catalogError && <p className="mt-4 text-xs text-[var(--muted)]">Il listino dinamico non è ancora configurato: il Super Admin può caricarlo dalle impostazioni.</p>}</div>{message && <p className="rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold">{message}</p>}<button disabled={loading || !prices[planType]} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Creazione…' : 'Crea e invia credenziali'} <Send size={16} /></button></form></div></div></main>
}
