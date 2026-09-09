'use client'

import { useState } from 'react'
import { Check, Mail, Pencil, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'

type Admin = { id: string; full_name: string | null; email: string; role: 'admin' | 'super_admin' | 'client'; status?: 'active' | 'suspended' | 'in_setup' | 'expired' | null; must_change_password: boolean }
type Draft = { fullName: string; email: string; role: 'admin' | 'client'; status: 'active' | 'suspended' }

export default function AdminManagement({ initialAdmins }: { initialAdmins: Admin[] }) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ fullName: '', email: '', role: 'admin', status: 'active' })
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  function beginEdit(admin: Admin) {
    setEditing(admin.id)
    setDraft({ fullName: admin.full_name || '', email: admin.email, role: admin.role === 'client' ? 'client' : 'admin', status: admin.status === 'suspended' ? 'suspended' : 'active' })
    setMessage(null)
  }

  async function patchAccount(id: string, payload: Partial<Draft>, successMessage: string) {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/admin/admins/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Operazione non riuscita.')
      setAdmins((items) => items.map((item) => item.id === id ? { ...item, ...body.profile } : item))
      setEditing(null); setMessage(successMessage)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operazione non riuscita.'); throw error } finally { setSaving(false) }
  }

  async function toggleStatus(admin: Admin) {
    const previousStatus = admin.status === 'suspended' ? 'suspended' : 'active'
    const nextStatus: Draft['status'] = previousStatus === 'suspended' ? 'active' : 'suspended'
    setToggling(admin.id); setMessage(null)
    setAdmins((items) => items.map((item) => item.id === admin.id ? { ...item, status: nextStatus } : item))
    try {
      await patchAccount(admin.id, { status: nextStatus }, nextStatus === 'active' ? 'Account riattivato.' : 'Account sospeso. L’accesso è stato bloccato.')
    } catch {
      setAdmins((items) => items.map((item) => item.id === admin.id ? { ...item, status: previousStatus } : item))
    } finally { setToggling(null) }
  }

  async function removeAccount(admin: Admin) {
    if (!window.confirm(`Eliminare definitivamente l'account ${admin.email}? L'operazione non è reversibile.`)) return
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Eliminazione non riuscita.')
      setAdmins((items) => items.filter((item) => item.id !== admin.id)); setMessage('Account eliminato definitivamente.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Eliminazione non riuscita.') } finally { setSaving(false) }
  }

  return <>
    {message && <p role="status" className="mt-6 rounded-2xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold text-[var(--blue)]">{message}</p>}
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {admins.map((admin) => <article key={admin.id} className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf0ff]"><ShieldCheck size={20} className="text-[var(--blue)]" /></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${admin.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-[#f2f8d8] text-[#4c701d]'}`}>{admin.status === 'suspended' ? 'Sospeso' : admin.role}</span></div>
        {editing === admin.id ? <div className="mt-6 space-y-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--blue)]">Scheda account</p><label className="block text-sm font-bold">Nome completo<input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><label className="block text-sm font-bold">Email di accesso<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Ruolo<select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft['role'] })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3"><option value="admin">Admin</option><option value="client">Revoca ruolo Admin / Client</option></select></label><label className="block text-sm font-bold">Accesso<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft['status'] })} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3"><option value="active">Attivo</option><option value="suspended">Sospeso</option></select></label></div><div className="flex flex-wrap gap-3"><button onClick={() => patchAccount(admin.id, draft, 'Modifiche salvate. Se l’email è cambiata, è stata inviata una notifica al nuovo indirizzo.')} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white"><Check size={15} />{saving ? 'Salvataggio…' : 'Salva modifiche'}</button><button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-bold"><X size={15} />Annulla</button></div></div> : <><h2 className="mt-6 text-xl font-bold">{admin.full_name || 'Nome non impostato'}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><Mail size={14} />{admin.email}</p><p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]"><UserRound size={14} />{admin.role === 'client' ? 'Ruolo Admin revocato' : 'Amministratore'}</p>{admin.must_change_password && <p className="mt-5 rounded-xl bg-[#fff0dc] px-3 py-2 text-xs font-bold text-[#8a5c12]">Cambio password richiesto al prossimo accesso</p>}<div className="mt-5 flex flex-wrap items-center gap-2"><button onClick={() => beginEdit(admin)} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-bold"><Pencil size={15} />Gestisci account</button>{admin.role !== 'client' && <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2.5 text-sm font-bold" title={admin.status === 'suspended' ? 'Riattiva account' : 'Metti in pausa account'}><span className="sr-only">{admin.status === 'suspended' ? 'Account sospeso, attiva' : 'Account attivo, sospendi'}</span><span className={admin.status === 'suspended' ? 'text-[var(--muted)]' : 'text-[#4c701d]'}>{admin.status === 'suspended' ? 'OFF' : 'ON'}</span><button type="button" role="switch" aria-checked={admin.status !== 'suspended'} disabled={toggling === admin.id || saving} onClick={() => toggleStatus(admin)} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cyan)] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${admin.status === 'suspended' ? 'bg-slate-300' : 'bg-[#5b9b27]'}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${admin.status === 'suspended' ? 'translate-x-0' : 'translate-x-5'}`} /></button></label>}<button onClick={() => removeAccount(admin)} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-[#f2c8c8] px-4 py-2.5 text-sm font-bold text-red-700"><Trash2 size={15} />Elimina</button></div></>}
      </article>)}
    </div>
    {admins.length === 0 && <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] p-12 text-center text-[var(--muted)]">Nessun account admin trovato.</div>}
  </>
}
