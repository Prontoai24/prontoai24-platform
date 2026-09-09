'use client'

import { useState } from 'react'
import { Check, Mail, Pencil, ShieldCheck, UserRound, X } from 'lucide-react'

type Admin = { id: string; full_name: string | null; email: string; role: 'admin' | 'super_admin' | 'client'; status?: 'active' | 'suspended' | 'in_setup' | 'expired' | null; must_change_password: boolean }

export default function AdminManagement({ initialAdmins }: { initialAdmins: Admin[] }) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ fullName: '', email: '', role: 'admin', status: 'active' })
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function beginEdit(admin: Admin) {
    setEditing(admin.id)
    setDraft({ fullName: admin.full_name || '', email: admin.email, role: admin.role === 'client' ? 'client' : 'admin', status: admin.status === 'suspended' ? 'suspended' : 'active' })
    setMessage(null)
  }

  async function save(id: string) {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/admin/admins/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Salvataggio non riuscito.')
      setAdmins((items) => items.map((item) => item.id === id ? { ...item, ...body.profile } : item))
      setEditing(null); setMessage('Modifiche salvate. Se l’email è cambiata, è stata inviata una notifica al nuovo indirizzo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Salvataggio non riuscito.') } finally { setSaving(false) }
  }

  return <>
    {message && <p role="status" className="mt-6 rounded-2xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold text-[var(--blue)]">{message}</p>}
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {admins.map((admin) => <article key={admin.id} className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf0ff]"><ShieldCheck size={20} className="text-[var(--blue)]" /></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${admin.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-[#f2f8d8] text-[#4c701d]'}`}>{admin.status === 'suspended' ? 'Sospeso' : admin.role}</span></div>
        {editing === admin.id ? <div className="mt-6 space-y-4"><label className="block text-sm font-bold">Nome completo<input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="block text-sm font-bold">Email di accesso<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Ruolo<select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3"><option value="admin">Admin</option><option value="client">Revoca ruolo Admin / Client</option></select></label><label className="block text-sm font-bold">Accesso<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3"><option value="active">Attivo</option><option value="suspended">Sospeso</option></select></label></div><div className="flex gap-3"><button onClick={() => save(admin.id)} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white"><Check size={15} />{saving ? 'Salvataggio…' : 'Salva'}</button><button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-bold"><X size={15} />Annulla</button></div></div> : <><h2 className="mt-6 text-xl font-bold">{admin.full_name || 'Nome non impostato'}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><Mail size={14} />{admin.email}</p><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><UserRound size={14} />{admin.role === 'client' ? 'Ruolo Admin revocato' : 'Amministratore'}</p>{admin.must_change_password && <p className="mt-5 rounded-xl bg-[#fff0dc] px-3 py-2 text-xs font-bold text-[#8a5c12]">Cambio password richiesto al prossimo accesso</p>}<button onClick={() => beginEdit(admin)} className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-bold"><Pencil size={15} />Modifica account</button></>}
      </article>)}
    </div>
    {admins.length === 0 && <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] p-12 text-center text-[var(--muted)]">Nessun account admin trovato.</div>}
  </>
}
