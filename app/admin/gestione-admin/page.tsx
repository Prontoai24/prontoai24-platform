import Link from 'next/link'
import { ArrowLeft, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function GestioneAdmin() {
  const supabase = createClient()
  const [{ data: profilo }, { data: admins }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').single(),
    supabase.from('profiles').select('id, full_name, email, role, must_change_password, created_at').in('role', ['admin', 'super_admin']).order('created_at', { ascending: false }),
  ])
  if (profilo?.role !== 'super_admin') return <main className="p-10">Accesso riservato al Super Admin.</main>
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-6xl"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Dashboard Admin</Link><div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Accessi e ruoli</p><h1 className="mt-2 text-4xl font-bold">Gestione Admin</h1><p className="mt-3 text-[var(--muted)]">Inviti e account della squadra operativa.</p></div><Link href="/admin/gestione-admin/nuovo" className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white"><UserPlus size={16} /> Invita Admin</Link></div><div className="mt-10 grid gap-4 md:grid-cols-2">{(admins ?? []).map((admin: any) => <article key={admin.id} className="rounded-3xl border border-[var(--line)] bg-white p-6"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf0ff]"><ShieldCheck size={20} className="text-[var(--blue)]" /></span><span className="rounded-full bg-[#f2f8d8] px-3 py-1 text-xs font-bold">{admin.role}</span></div><h2 className="mt-6 text-xl font-bold">{admin.full_name || 'Nome non impostato'}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><Mail size={14} />{admin.email}</p>{admin.must_change_password && <p className="mt-5 rounded-xl bg-[#fff0dc] px-3 py-2 text-xs font-bold text-[#8a5c12]">Cambio password richiesto al prossimo accesso</p>}</article>)}</div>{(!admins || admins.length === 0) && <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] p-12 text-center text-[var(--muted)]">Nessun account admin trovato.</div>}</div></main>
}
