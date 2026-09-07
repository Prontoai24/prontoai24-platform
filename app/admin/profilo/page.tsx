import Link from 'next/link'
import { ArrowLeft, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfiloAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single() : { data: null }
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-2xl"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Dashboard Admin</Link><section className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-8"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f8f6] text-[var(--blue)]"><UserRound size={22} /></span><p className="mt-6 text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Profilo</p><h1 className="mt-2 text-4xl font-bold">Il mio Profilo</h1><dl className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#f7fbff] p-4"><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Nome</dt><dd className="mt-2 font-bold">{profile?.full_name || 'Amministratore'}</dd></div><div className="rounded-2xl bg-[#f7fbff] p-4"><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Email</dt><dd className="mt-2 break-all font-bold">{profile?.email || user?.email || '—'}</dd></div><div className="rounded-2xl bg-[#f7fbff] p-4"><dt className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Ruolo</dt><dd className="mt-2 font-bold">{profile?.role || '—'}</dd></div></dl></section></div></main>
}
