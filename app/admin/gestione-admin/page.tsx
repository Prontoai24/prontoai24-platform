import Link from 'next/link'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AdminManagement from '@/components/admin/AdminManagement'

export const dynamic = 'force-dynamic'

export default async function GestioneAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: profilo }, { data: admins }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
    supabase.from('profiles').select('id, full_name, email, role, status, must_change_password').in('role', ['admin', 'client']).order('created_at', { ascending: false }),
  ])
  if (profilo?.role !== 'super_admin') return <main className="p-10">Accesso riservato al Super Admin.</main>
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)] lg:px-10"><div className="mx-auto max-w-6xl"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"><ArrowLeft size={16} /> Dashboard Admin</Link><div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--blue)]">Accessi e ruoli</p><h1 className="mt-2 text-4xl font-bold">Gestione Admin</h1><p className="mt-3 text-[var(--muted)]">Sospendi account, aggiorna credenziali e revoca il ruolo amministrativo.</p></div><Link href="/admin/gestione-admin/nuovo" className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white"><UserPlus size={16} /> Invita Admin</Link></div><AdminManagement initialAdmins={(admins ?? []) as any} /></div></main>
}
