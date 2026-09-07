'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Search, Send, ShieldCheck, Upload } from 'lucide-react'

const MINUTES = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]
const TIERS = [
  { key: 'base', name: 'Base', text: 'Per iniziare a portare l’AI nei processi quotidiani.', accent: 'bg-[#e5f8f6]' },
  { key: 'evoluto', name: 'Evoluto', text: 'Per team che vogliono automazioni e assistenti più avanzati.', accent: 'bg-[#eaf0ff]' },
  { key: 'enterprise', name: 'Enterprise', text: 'Per organizzazioni con esigenze estese e flussi su misura.', accent: 'bg-[#f2f8d8]' },
]
type CatalogItem = { plan_type: string; included_minutes: number; billing_cycle: string; price_cents: number }
type AvailableNumber = { phone_number: string; phone_number_type?: string; region_information?: { region_name?: string }; cost_information?: { monthly_cost?: string } }
type Phase = 'Cliente' | 'Compliance' | 'Numero' | 'Vapi' | 'Completato'

export default function NuovoCliente() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [minutesIndex, setMinutesIndex] = useState(2)
  const [billingCycle, setBillingCycle] = useState<'trimestrale' | 'annuale'>('annuale')
  const [planType, setPlanType] = useState('evoluto')
  const [form, setForm] = useState({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '', billingAddress: '' })
  const [search, setSearch] = useState({ city: '', prefix: '' })
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [selectedNumber, setSelectedNumber] = useState('')
  const [companyDocument, setCompanyDocument] = useState<File | null>(null)
  const [representativeDocument, setRepresentativeDocument] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [phase, setPhase] = useState<Phase | null>(null)
  const includedMinutes = MINUTES[minutesIndex]

  useEffect(() => {
    let mounted = true
    async function loadCatalog() {
      try {
        const response = await fetch('/api/admin/plans', { cache: 'no-store' }); const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Impossibile aggiornare il listino.')
        if (mounted) { setCatalog(body.catalog || []); setCatalogError(null) }
      } catch (caught) { if (mounted) setCatalogError(caught instanceof Error ? caught.message : 'Impossibile aggiornare il listino.') }
    }
    const refresh = () => { void loadCatalog() }; const onStorage = (event: StorageEvent) => { if (event.key === 'pricing-catalog-updated') refresh() }; const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    void loadCatalog(); window.addEventListener('focus', refresh); window.addEventListener('storage', onStorage); document.addEventListener('visibilitychange', onVisibility); const interval = window.setInterval(refresh, 15000); const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pricing-catalog') : null; channel?.addEventListener('message', refresh)
    return () => { mounted = false; window.removeEventListener('focus', refresh); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisibility); window.clearInterval(interval); channel?.close() }
  }, [])

  const prices = useMemo(() => Object.fromEntries(TIERS.map((tier) => { const item = catalog.find((entry) => entry.plan_type === tier.key && entry.included_minutes === includedMinutes && entry.billing_cycle === billingCycle); return [tier.key, item ? item.price_cents / 100 : 0] })), [catalog, includedMinutes, billingCycle])
  function update(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })) }

  async function searchNumbers(event: React.FormEvent) {
    event.preventDefault(); setSearching(true); setError(null)
    try {
      const params = new URLSearchParams({ 'filter[country_code]': 'IT', 'filter[phone_number_type]': 'local', 'filter[limit]': '20' })
      if (search.city) params.set('filter[locality]', search.city)
      if (search.prefix) params.set('filter[phone_number][contains]', `+39${search.prefix}`)
      const response = await fetch(`/api/admin/provisioning/telnyx?${params.toString()}`); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Ricerca numeri non riuscita.')
      setNumbers(body.data || []); setSelectedNumber(''); if (!(body.data || []).length) setMessage('Nessun numero italiano trovato per i filtri selezionati.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Ricerca numeri non riuscita.') } finally { setSearching(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null); setMessage(null)
    try {
      if (!selectedNumber) throw new Error('Seleziona prima un numero italiano.')
      if (!companyDocument || !representativeDocument) throw new Error('Carica visura camerale e documento del legale rappresentante.')
      setPhase('Cliente')
      const clientResponse = await fetch('/api/admin/clienti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, planType, includedMinutes, billingCycle, monthlyPrice: prices[planType], sendInvite: true }) })
      const clientBody = await clientResponse.json().catch(() => ({})); if (!clientResponse.ok) throw new Error(clientBody.error || 'Creazione cliente non riuscita.')
      const clientId = clientBody.client?.id; if (!clientId) throw new Error('Il backend non ha restituito il clientId.')

      setPhase('Compliance')
      const compliance = new FormData(); compliance.set('clientId', clientId); compliance.set('phoneNumberType', 'local'); compliance.set('customerReference', form.companyName); compliance.set('requirements', JSON.stringify({ company_name: form.companyName, vat_number: form.vatNumber, address: form.billingAddress, contact_phone: form.contactPhone })); compliance.set('companyDocument', companyDocument); compliance.set('representativeDocument', representativeDocument)
      const complianceResponse = await fetch('/api/admin/provisioning/telnyx/compliance', { method: 'POST', body: compliance }); const complianceBody = await complianceResponse.json().catch(() => ({})); if (!complianceResponse.ok) throw new Error(complianceBody.error || 'Compliance Telnyx non riuscita.')

      setPhase('Numero')
      const orderResponse = await fetch('/api/admin/provisioning/telnyx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, phoneNumbers: [selectedNumber], requirementGroupId: complianceBody.requirementGroup?.id, messagingProfileId: undefined }) }); const orderBody = await orderResponse.json().catch(() => ({})); if (!orderResponse.ok) throw new Error(orderBody.error || 'Ordine Telnyx non riuscito.')
      const phoneRecord = orderBody.phoneRecords?.[0]

      setPhase('Vapi')
      const vapiResponse = await fetch('/api/admin/provisioning/vapi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, phoneNumber: selectedNumber, phoneNumberId: phoneRecord?.id, assistant: { name: `ProntoAI24 - ${form.companyName}`, firstMessage: `Benvenuto in ${form.companyName}. Come posso aiutarti?` } }) }); const vapiBody = await vapiResponse.json().catch(() => ({})); if (!vapiResponse.ok) throw new Error(vapiBody.error || 'Provisioning Vapi non riuscito.')
      setPhase('Completato'); setMessage(`Onboarding completato per ${form.companyName}. Numero in stato ${orderBody.order?.status || 'pending'}; compliance e attivazione Telnyx restano monitorate dal webhook.`); setForm({ companyName: '', vatNumber: '', contactEmail: '', contactPhone: '', billingAddress: '' }); setSelectedNumber(''); setCompanyDocument(null); setRepresentativeDocument(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Onboarding non riuscito.') } finally { setLoading(false) }
  }

  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-6xl"><Link href="/admin/clienti" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Clienti</Link><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Onboarding operativo</p><h1 className="mt-3 text-4xl font-bold">Crea cliente e attiva la fonia AI</h1><p className="mt-4 leading-7 text-[var(--muted)]">Raccogli i dati, verifica un numero +39 e avvia compliance Telnyx, ordine e assistente Vapi in cascata.</p>{phase && <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">{(['Cliente', 'Compliance', 'Numero', 'Vapi', 'Completato'] as Phase[]).map((item) => <span key={item} className={`rounded-full px-3 py-2 ${item === phase ? 'bg-[var(--ink)] text-white' : 'bg-[#e5f8f6] text-[var(--blue)]'}`}>{item}</span>)}</div>}{message && <p className="mt-6 rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold" role="status">{message}</p>}{error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</p>}<form onSubmit={submit} className="mt-8 grid gap-6"><section className="grid gap-5 rounded-3xl border border-[var(--line)] p-5 sm:grid-cols-2"><h2 className="text-xl font-bold sm:col-span-2">1. Anagrafica e compliance</h2><label className="text-sm font-bold sm:col-span-2">Ragione sociale<input required value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Partita IVA<input required value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Telefono referente<input required value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Email referente<input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold sm:col-span-2">Indirizzo legale<input required value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="text-sm font-bold">Visura camerale PDF<input required type="file" accept="application/pdf,image/*" onChange={(e) => setCompanyDocument(e.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label><label className="text-sm font-bold">ID legale rappresentante<input required type="file" accept="application/pdf,image/*" onChange={(e) => setRepresentativeDocument(e.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label></section><section className="rounded-3xl border border-[var(--line)] p-5"><div className="flex items-center gap-3"><Search className="text-[var(--blue)]" /><div><h2 className="text-xl font-bold">2. Cerca e seleziona numero +39</h2><p className="text-sm text-[var(--muted)]">La ricerca usa l’inventario Telnyx e non acquista il numero.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input placeholder="Città (es. Milano)" value={search.city} onChange={(e) => setSearch({ ...search, city: e.target.value })} className="rounded-2xl border border-[var(--line)] px-4 py-3" /><input placeholder="Prefisso (es. 02)" value={search.prefix} onChange={(e) => setSearch({ ...search, prefix: e.target.value })} className="rounded-2xl border border-[var(--line)] px-4 py-3" /><button type="button" onClick={(event) => void searchNumbers(event as unknown as React.FormEvent)} disabled={searching} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-50"><Search size={16} /> {searching ? 'Ricerca…' : 'Cerca numeri'}</button></div>{numbers.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{numbers.map((item) => <button type="button" key={item.phone_number} onClick={() => setSelectedNumber(item.phone_number)} className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left ${selectedNumber === item.phone_number ? 'border-[var(--blue)] bg-[#eaf0ff]' : 'border-[var(--line)]'}`}><span className="font-bold">{item.phone_number}</span><span className="text-xs text-[var(--muted)]">{item.region_information?.region_name || item.phone_number_type || 'Italia'}</span></button>)}</div>}{selectedNumber && <p className="mt-4 text-sm font-bold text-[var(--blue)]">Numero selezionato: {selectedNumber}</p>}</section><section className="rounded-3xl border border-[var(--line)] bg-[#f7fbff] p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-[var(--blue)]" /><div><h2 className="text-xl font-bold">3. Piano e provisioning</h2><p className="text-sm text-[var(--muted)]">Dopo la creazione, il backend avvia compliance, ordine e Vapi.</p></div></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setBillingCycle('trimestrale')} className={`rounded-full px-4 py-2 text-sm font-bold ${billingCycle === 'trimestrale' ? 'bg-[var(--ink)] text-white' : 'bg-white'}`}>Trimestrale</button><button type="button" onClick={() => setBillingCycle('annuale')} className={`rounded-full px-4 py-2 text-sm font-bold ${billingCycle === 'annuale' ? 'bg-[var(--ink)] text-white' : 'bg-white'}`}>Annuale -20%</button></div><label className="mt-5 block text-sm font-bold">Minuti inclusi: <span className="text-[var(--blue)]">{includedMinutes.toLocaleString('it-IT')} min/mese</span><input type="range" min="0" max={MINUTES.length - 1} value={minutesIndex} onChange={(e) => setMinutesIndex(Number(e.target.value))} className="mt-3 w-full accent-[#0b6e9e]" /></label><div className="mt-5 grid gap-3 md:grid-cols-3">{TIERS.map((tier) => <button type="button" key={tier.key} onClick={() => setPlanType(tier.key)} className={`rounded-2xl border-2 p-4 text-left ${planType === tier.key ? 'border-[var(--blue)] bg-white' : 'border-transparent bg-white/70'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tier.accent}`}><Check size={16} /></span><h3 className="mt-3 font-bold">{tier.name}</h3><p className="mt-2 text-2xl font-bold">{prices[tier.key] ? `€${prices[tier.key].toFixed(2)}` : '—'}</p></button>)}</div>{catalogError && <p className="mt-4 text-xs font-semibold text-red-700">{catalogError}</p>}</section><button type="submit" disabled={loading || !prices[planType] || !selectedNumber} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Provisioning in corso…' : 'Crea cliente e attiva onboarding'} <Send size={16} /></button></form></div></div></main>
}
