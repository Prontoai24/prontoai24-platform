'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, KeyRound, LockKeyhole, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/
const passwordRules = [
  { label: 'Almeno 8 caratteri', test: (value: string) => value.length >= 8 },
  { label: 'Una lettera maiuscola', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un numero', test: (value: string) => /[0-9]/.test(value) },
  { label: 'Un carattere speciale (= @ $ ! % * # ? &)', test: (value: string) => SPECIAL_CHARACTER_REGEX.test(value) },
]

export default function CambioPasswordObbligatorio() {
  const [nuovaPassword, setNuovaPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErrore(null); setSuccesso(null)
    if (!passwordRules.every(({ test }) => test(nuovaPassword))) return setErrore('La password non rispetta tutti i requisiti di sicurezza.')
    if (nuovaPassword !== conferma) return setErrore('Le password non coincidono.')
    setCaricamento(true)
    try {
      const response = await fetch('/api/auth/complete-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: nuovaPassword }), cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.profileCompleted !== true) throw new Error(body.error || 'Impossibile completare il profilo.')
      // La route server ha già invalidato i cookie HTTP-only; questo pulisce anche
      // lo storage del client Supabase e impedisce il riuso del token corrente.
      await createClient().auth.signOut({ scope: 'global' }).catch(() => {})
      setSuccesso('Password aggiornata con successo. Effettua il login con la nuova password.')
      window.setTimeout(() => window.location.replace('/login?updated=true'), 700)
    } catch (error) {
      setErrore(error instanceof Error ? error.message : 'Si è verificato un errore durante il salvataggio. Riprova.')
    } finally { setCaricamento(false) }
  }

  return <main className="grid-paper flex min-h-screen items-center justify-center px-6 py-12"><section className="w-full max-w-lg rounded-[30px] border border-[var(--line)] bg-white p-7 shadow-xl shadow-[#0b6e9e]/10 sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f8f6] text-[var(--blue)]"><LockKeyhole size={23} /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-[var(--blue)]">Primo accesso</p><h1 className="mt-3 text-3xl font-bold text-[var(--ink)]">Imposta una nuova password</h1><p className="mt-4 leading-7 text-[var(--muted)]">Per proteggere il tuo account devi sostituire la password temporanea prima di accedere alla dashboard Admin.</p><form onSubmit={handleSubmit} className="mt-8 space-y-5"><label className="block text-sm font-semibold text-[var(--ink)]">Nuova password<input type="password" value={nuovaPassword} onChange={(event) => setNuovaPassword(event.target.value)} required autoComplete="new-password" className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none transition focus:border-[var(--cyan)] focus:ring-2 focus:ring-[var(--cyan)]/20" /></label><label className="block text-sm font-semibold text-[var(--ink)]">Conferma nuova password<input type="password" value={conferma} onChange={(event) => setConferma(event.target.value)} required autoComplete="new-password" className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none transition focus:border-[var(--cyan)] focus:ring-2 focus:ring-[var(--cyan)]/20" /></label><div className="rounded-2xl bg-[var(--paper)] p-4"><p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]"><KeyRound size={16} className="text-[var(--blue)]" /> Requisiti di sicurezza</p><ul className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">{passwordRules.map(({ label, test }) => <li key={label} className="flex items-center gap-2"><Check size={15} className={test(nuovaPassword) ? 'text-[#5b9b27]' : 'text-[var(--line)]'} />{label}</li>)}</ul></div>{errore && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errore}</p>}{successo && <p role="status" className="rounded-xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold text-[var(--blue)]">{successo}</p>}<button type="submit" disabled={caricamento} className="btn-primary w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{caricamento ? 'Salvataggio…' : 'Salva password e accedi'}</button></form><Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)] hover:underline"><ArrowLeft size={16} /> Torna al Login</Link></section></main>
}
