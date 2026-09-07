import Link from 'next/link'
import { ArrowLeft, BarChart3, CircleDollarSign, Headphones, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ReportAdmin() {
  const supabase = createClient()
  const [{ data: clients }, { data: subscriptions }, { data: plans }, { data: tickets }] = await Promise.all([
    supabase.from('clients').select('id, status'),
    supabase.from('subscriptions').select('client_id, tier, minutes_package, minutes_used_current_period, status'),
    supabase.from('pricing_plans').select('tier, minutes_package, base_price_cents, active'),
    supabase.from('tickets').select('id, status'),
  ])
  const activeClients = (clients ?? []).filter((item: any) => item.status === 'active').length
  const activeSubscriptions = (subscriptions ?? []).filter((item: any) => item.status === 'active') as any[]
  const consumed = activeSubscriptions.reduce((sum, item) => sum + Number(item.minutes_used_current_period || 0), 0)
  const mrr = activeSubscriptions.reduce((sum, item) => { const plan = (plans ?? []).find((candidate: any) => candidate.tier === item.tier && candidate.minutes_package === item.minutes_package && candidate.active); return sum + Number(plan?.base_price_cents || 0) }, 0)
  const openTickets = (tickets ?? []).filter((item: any) => !['resolved', 'closed'].includes(item.status)).length
  const cards = [{ Icon: CircleDollarSign, label: 'MRR stimato', value: `€${(mrr / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, hint: 'Da listini e abbonamenti attivi', color: 'bg-[#f2f8d8]' }, { Icon: Users, label: 'Clienti attivi', value: activeClients, hint: 'Account con stato active', color: 'bg-[#e5f8f6]' }, { Icon: Zap, label: 'Minuti consumati', value: Math.round(consumed).toLocaleString('it-IT'), hint: 'Periodo corrente', color: 'bg-[#eaf0ff]' }, { Icon: Headphones, label: 'Ticket aperti', value: openTickets, hint: 'Richiedono attenzione', color: 'bg-[#fff0dc]' }]
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-7xl"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Dashboard Admin</Link><div className="mt-8 flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Reportistica</p><h1 className="mt-2 text-4xl font-bold">Panoramica della piattaforma</h1><p className="mt-3 text-[var(--muted)]">Indicatori calcolati dai dati Supabase correnti.</p></div><BarChart3 className="hidden text-[var(--blue)] sm:block" size={36} /></div><section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ Icon, label, value, hint, color }) => <div key={label} className="rounded-3xl border border-[var(--line)] bg-white p-6"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}><Icon size={19} /></span><p className="mt-6 text-sm font-semibold text-[var(--muted)]">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-[var(--muted)]">{hint}</p></div>)}</section><div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-7"><h2 className="text-2xl font-bold">Nota sui dati</h2><p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">Il MRR è una stima basata sul prezzo base del listino associato a tier e pacchetto minuti. Per includere add-on, sconti, tasse e ricorrenze Stripe, la sincronizzazione delle fatture e dei subscription item deve essere completata nel catalogo Stripe.</p></div></div></main>
}
