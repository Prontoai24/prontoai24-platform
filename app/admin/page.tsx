import Link from 'next/link'
import { ArrowUpRight, Bot, Building2, CircleDollarSign, Headphones, ShieldCheck, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = { active: 'Attivo', in_setup: 'In setup', suspended: 'Sospeso', expired: 'Scaduto' }

export default async function DashboardAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profilo }, { data: clienti }] = await Promise.all([
    supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
    supabase.from('clients').select('id, company_name, contact_email, status, created_at, subscriptions(tier, minutes_package, minutes_used_current_period, status)').order('created_at', { ascending: false }),
  ])

  const rows = (clienti ?? []) as Array<any>
  const attivi = rows.filter((client) => client.status === 'active').length
  const minuti = rows.reduce((total, client) => total + Number(client.subscriptions?.[0]?.minutes_used_current_period ?? 0), 0)
  const setup = rows.filter((client) => client.status === 'in_setup').length

  return (
    <main className="min-h-screen bg-[#f7fbff] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white px-6 py-5 lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] font-bold text-white">P</span><span className="font-bold">ProntoAI<span className="text-[var(--cyan)]">24</span> <span className="ml-2 hidden text-sm font-medium text-[var(--muted)] sm:inline">Admin Console</span></span></Link><div className="flex items-center gap-4 text-sm"><span className="hidden text-[var(--muted)] sm:inline">{profilo?.full_name || 'Amministratore'}</span><span className="rounded-full bg-[#e5f8f6] px-3 py-1 font-bold text-[var(--blue)]">{profilo?.role}</span></div></div></header>
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Regia della piattaforma</p><h1 className="mt-2 text-4xl font-bold">Buongiorno, {profilo?.full_name?.split(' ')[0] || 'Admin'}.</h1><p className="mt-3 text-[var(--muted)]">Tutto sotto controllo, in un unico spazio operativo.</p></div><div className="flex gap-3"><Link href="/admin/clienti/nuovo" className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#173d58]">+ Nuovo cliente</Link>{profilo?.role === 'super_admin' && <Link href="/admin/gestione-admin" className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold">Gestisci Admin</Link>}</div></div>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
          { Icon: Building2, label: 'Clienti totali', value: rows.length, hint: 'Anagrafiche nella piattaforma', color: 'bg-[#eaf0ff]' },
          { Icon: Users, label: 'Clienti attivi', value: attivi, hint: 'Account con servizio attivo', color: 'bg-[#e5f8f6]' },
          { Icon: Zap, label: 'Minuti consumati', value: Math.round(minuti).toLocaleString('it-IT'), hint: 'Periodo corrente', color: 'bg-[#f2f8d8]' },
          { Icon: Headphones, label: 'In setup', value: setup, hint: 'Richiedono attenzione', color: 'bg-[#fff0dc]' },
        ].map(({ Icon, label, value, hint, color }) => <div key={label} className="rounded-3xl border border-[var(--line)] bg-white p-6"><div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}><Icon size={19} /></span><ArrowUpRight size={17} className="text-[var(--muted)]" /></div><p className="mt-7 text-sm font-semibold text-[var(--muted)]">{label}</p><p className="mt-1 text-3xl font-bold">{String(value)}</p><p className="mt-2 text-xs text-[var(--muted)]">{hint}</p></div>)}</section>
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><div className="rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Clienti recenti</h2><p className="mt-1 text-sm text-[var(--muted)]">Ultime anagrafiche gestite dalla piattaforma.</p></div><Link href="/admin/clienti" className="text-sm font-bold text-[var(--blue)]">Vedi tutti</Link></div><div className="mt-7 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="pb-3">Azienda</th><th className="pb-3">Piano</th><th className="pb-3">Stato</th><th className="pb-3">Contatto</th></tr></thead><tbody>{rows.slice(0, 8).map((client) => <tr key={client.id} className="border-b border-[var(--line)] last:border-0"><td className="py-4 font-bold">{client.company_name || 'Azienda non indicata'}<span className="mt-1 block text-xs font-normal text-[var(--muted)]">{client.contact_email}</span></td><td className="py-4">{client.subscriptions?.[0] ? `${client.subscriptions[0].tier} · ${client.subscriptions[0].minutes_package} min` : 'Da assegnare'}</td><td className="py-4"><span className="rounded-full bg-[#f2f8d8] px-3 py-1 text-xs font-bold">{statusLabel[client.status] ?? client.status}</span></td><td className="py-4 text-[var(--muted)]">{new Date(client.created_at).toLocaleDateString('it-IT')}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="py-12 text-center text-sm text-[var(--muted)]">Nessun cliente presente. Crea la prima anagrafica per iniziare.</div>}</div></div><aside className="space-y-6"><div className="rounded-3xl bg-[var(--ink)] p-7 text-white"><ShieldCheck className="text-[var(--lime)]" size={25} /><h2 className="mt-6 text-2xl font-bold">Controlli rapidi</h2><div className="mt-6 grid gap-3 text-sm"><Link href="/admin/clienti" className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15">Anagrafiche clienti <ArrowUpRight size={16} /></Link><Link href="/admin/gestione-admin" className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15">Inviti e ruoli <ArrowUpRight size={16} /></Link><Link href="/admin/report" className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15">Reportistica <ArrowUpRight size={16} /></Link><Link href="/admin/impostazioni" className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/15">Listini e provider <ArrowUpRight size={16} /></Link></div></div><div className="rounded-3xl border border-[var(--line)] bg-white p-7"><CircleDollarSign className="text-[var(--blue)]" size={24} /><h3 className="mt-5 text-xl font-bold">Piani e fatturazione</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Gestisci listini, add-on e riferimenti Stripe dalla sezione configurazione.</p><Link href="/admin/report" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]">Apri report <ArrowUpRight size={15} /></Link></div></aside></section>
      </div>
    </main>
  )
}
