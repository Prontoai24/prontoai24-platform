'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileUp, KeyRound, Plus, Save, X } from 'lucide-react'

type CatalogItem = { id: string; plan_type: string; included_minutes: number; billing_cycle: string; price_cents: number }
type ProviderItem = { id: string; provider: string; label: string; secret_reference: string }

const MINUTES = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]

type Toast = { kind: 'success' | 'error'; text: string }

export default function ImpostazioniAdmin() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingProvider, setIsSavingProvider] = useState(false)
  const [plan, setPlan] = useState({ planType: 'base', includedMinutes: '300', billingCycle: 'annuale', priceCents: '0' })
  const [provider, setProvider] = useState({ provider: 'telnyx', label: '', secretReference: '' })

  function notify(kind: Toast['kind'], text: string) {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 5000)
  }

  function announceCatalogUpdate() {
    const updatedAt = String(Date.now())
    window.localStorage.setItem('pricing-catalog-updated', updatedAt)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('pricing-catalog')
      channel.postMessage({ updatedAt })
      channel.close()
    }
  }

  async function load() {
    try {
      const [plansResponse, providersResponse] = await Promise.all([
        fetch('/api/admin/plans', { cache: 'no-store' }),
        fetch('/api/admin/providers', { cache: 'no-store' }),
      ])
      const plans = await plansResponse.json().catch(() => ({}))
      const providerBody = await providersResponse.json().catch(() => ({}))
      if (!plansResponse.ok) throw new Error(plans.error || 'Impossibile caricare il listino.')
      if (!providersResponse.ok) throw new Error(providerBody.error || 'Impossibile caricare i provider.')
      setCatalog(plans.catalog || [])
      setProviders(providerBody.providers || [])
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Errore nel caricamento della configurazione.')
    }
  }

  useEffect(() => { void load() }, [])

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingPlan(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, includedMinutes: Number(plan.includedMinutes), priceCents: Number(plan.priceCents) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Errore nel salvataggio del prezzo.')
      setMessage('Prezzo salvato nel catalogo dinamico.')
      notify('success', 'Prezzo salvato nel catalogo dinamico.')
      setPlan((current) => ({ ...current, priceCents: '0' }))
      await load()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Errore nel salvataggio del prezzo.'
      setMessage(text)
      notify('error', text)
    } finally {
      setIsSavingPlan(false)
    }
  }

  async function uploadPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pdf) {
      notify('error', 'Seleziona prima un file PDF da importare.')
      return
    }
    setIsImporting(true)
    setMessage(null)
    try {
      const data = new FormData()
      data.set('file', pdf)
      const response = await fetch('/api/admin/plans/import', { method: 'POST', body: data })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Importazione PDF non riuscita.')
      const imported = Number(body.imported || 0)
      const text = `Importate ${imported} righe dal PDF.`
      setMessage(text)
      notify('success', text)
      setPdf(null)
      announceCatalogUpdate()
      const input = document.getElementById('pricing-pdf') as HTMLInputElement | null
      if (input) input.value = ''
      await load()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Importazione PDF non riuscita.'
      setMessage(text)
      notify('error', text)
    } finally {
      setIsImporting(false)
    }
  }

  async function saveProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProvider(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Errore nel salvataggio del provider.')
      setMessage('Riferimento provider salvato.')
      notify('success', 'Riferimento provider salvato.')
      setProvider({ provider: 'telnyx', label: '', secretReference: '' })
      await load()
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Errore nel salvataggio del provider.'
      setMessage(text)
      notify('error', text)
    } finally {
      setIsSavingProvider(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10">
      {toast && (
        <div className="fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold shadow-xl" role="status" aria-live="polite">
          <span className={toast.kind === 'success' ? 'text-emerald-700' : 'text-red-700'}>{toast.text}</span>
          <button type="button" aria-label="Chiudi notifica" onClick={() => setToast(null)} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Dashboard Admin</Link>
        <div className="mt-8"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Configurazione</p><h1 className="mt-2 text-4xl font-bold">Listini e provider</h1><p className="mt-3 max-w-2xl text-[var(--muted)]">Gestisci i prezzi per piano, minuti e ciclo di fatturazione. Le credenziali provider restano riferimenti ai secret di deploy.</p></div>
        {message && <p className="mt-6 rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold" role="status">{message}</p>}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-7">
            <h2 className="text-2xl font-bold">Gestione Listino Prezzi</h2><p className="mt-2 text-sm text-[var(--muted)]">Aggiungi o aggiorna una combinazione piano/minuti/ciclo.</p>
            <form onSubmit={savePlan} className="mt-6 grid gap-4">
              <div className="grid grid-cols-2 gap-3"><select value={plan.planType} onChange={(e) => setPlan({ ...plan, planType: e.target.value })} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3"><option value="base">Base</option><option value="evoluto">Evoluto</option><option value="enterprise">Enterprise</option></select><select value={plan.includedMinutes} onChange={(e) => setPlan({ ...plan, includedMinutes: e.target.value })} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">{MINUTES.map((m) => <option key={m} value={m}>{m.toLocaleString('it-IT')} min</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3"><select value={plan.billingCycle} onChange={(e) => setPlan({ ...plan, billingCycle: e.target.value })} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3"><option value="trimestrale">Trimestrale</option><option value="annuale">Annuale</option></select><input required type="number" min="0" step="0.01" placeholder="Prezzo € / mese" value={plan.priceCents === '0' ? '' : (Number(plan.priceCents) / 100).toString()} onChange={(e) => setPlan({ ...plan, priceCents: String(Math.round(Number(e.target.value || 0) * 100)) })} className="rounded-2xl border border-[var(--line)] px-4 py-3" /></div>
              <button type="submit" disabled={isSavingPlan} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><Plus size={16} /> {isSavingPlan ? 'Salvataggio…' : 'Salva prezzo'}</button>
            </form>
            <form onSubmit={uploadPdf} className="mt-6 rounded-2xl border border-dashed border-[var(--blue)] bg-[#f7fbff] p-4">
              <p className="font-bold">Upload PDF Listino</p><p className="mt-1 text-xs text-[var(--muted)]">Parser automatico per PDF testuali con piano, minuti e prezzo.</p>
              <input id="pricing-pdf" required={!pdf} type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} className="mt-4 block w-full text-sm" />
              <button type="submit" disabled={isImporting || !pdf} aria-busy={isImporting} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--blue)] px-4 py-2 text-sm font-bold text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-60"><FileUp size={16} /> {isImporting ? 'Importazione…' : 'Importa PDF'}</button>
            </form>
            <div className="mt-8 max-h-72 space-y-2 overflow-auto">{catalog.map((item) => <div key={item.id} className="flex justify-between rounded-2xl bg-[#f7fbff] px-4 py-3 text-sm"><span className="font-bold capitalize">{item.plan_type} · {item.included_minutes} min · {item.billing_cycle}</span><span>€{(item.price_cents / 100).toFixed(2)}</span></div>)}</div>
          </section>
          <section className="rounded-3xl border border-[var(--line)] bg-white p-7">
            <div className="flex items-center gap-3"><KeyRound className="text-[var(--blue)]" /><div><h2 className="text-2xl font-bold">Provider API</h2><p className="mt-1 text-sm text-[var(--muted)]">Salva solo il nome del secret di deploy.</p></div></div>
            <form onSubmit={saveProvider} className="mt-6 grid gap-4"><select value={provider.provider} onChange={(e) => setProvider({ ...provider, provider: e.target.value })} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3"><option value="telnyx">Telnyx</option><option value="vapi">Vapi</option><option value="elevenlabs">ElevenLabs</option><option value="deepgram">Deepgram</option></select><input required placeholder="Label (es. produzione)" value={provider.label} onChange={(e) => setProvider({ ...provider, label: e.target.value })} className="rounded-2xl border border-[var(--line)] px-4 py-3" /><input required placeholder="Variabile env (es. TELNYX_API_KEY)" value={provider.secretReference} onChange={(e) => setProvider({ ...provider, secretReference: e.target.value.toUpperCase() })} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-mono text-sm" /><button type="submit" disabled={isSavingProvider} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} /> {isSavingProvider ? 'Salvataggio…' : 'Salva riferimento'}</button></form>
            <div className="mt-8 space-y-2">{providers.map((item) => <div key={item.id} className="flex justify-between rounded-2xl bg-[#f7fbff] px-4 py-3 text-sm"><span className="font-bold">{item.provider} · {item.label}</span><code className="text-[var(--blue)]">{item.secret_reference}</code></div>)}</div>
          </section>
        </div>
      </div>
    </main>
  )
}
