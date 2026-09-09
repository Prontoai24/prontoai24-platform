'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const securityPoints = ['Sessione firmata e protetta', 'Credenziali personali e verificabili', 'Accesso riservato alla console Admin']

export default function PaginaLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(false)
  const router = useRouter()
  const [resetCompletato, setResetCompletato] = useState(false)

  useEffect(() => {
    setResetCompletato(new URLSearchParams(window.location.search).get('reset') === 'success')
  }, [])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrore(null)
    setCaricamento(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error('Email o password non corretti.')
      router.replace('/admin')
      router.refresh()
    } catch (error) {
      setErrore(error instanceof Error ? error.message : 'Impossibile completare l’accesso. Riprova.')
    } finally {
      setCaricamento(false)
    }
  }

  return <main className="grid-paper min-h-screen px-4 pb-36 pt-6 sm:px-6 sm:pb-40 sm:pt-10"><div className="mx-auto flex w-full max-w-6xl flex-col"><header className="flex items-center justify-between"><Link href="/" aria-label="Torna a prontoai24.it" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white shadow-lg shadow-[#102a43]/15">P</span><span className="font-bold tracking-[-.04em] text-[var(--ink)]">ProntoAI<span className="text-[var(--cyan)]">24</span></span></Link><span className="hidden rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-[var(--blue)] backdrop-blur sm:inline-flex">ProntoAI24 <span className="mx-2 text-[var(--line)]">•</span> Admin Area</span></header>
      <div className="mt-10 grid overflow-hidden rounded-[30px] border border-[var(--line)] bg-white shadow-2xl shadow-[#102a43]/10 lg:grid-cols-[.92fr_1.08fr] lg:rounded-[36px]"><section className="relative overflow-hidden bg-[var(--ink)] px-7 py-9 text-white sm:px-10 sm:py-12 lg:px-12 lg:py-14"><div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--cyan)]/20 blur-3xl" /><div className="relative"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--lime)]"><ShieldCheck size={24} /></span><p className="mt-9 text-xs font-bold uppercase tracking-[.18em] text-[var(--lime)]">Admin Console</p><h1 className="mt-4 max-w-md text-3xl font-bold leading-tight sm:text-4xl">Controllo della piattaforma, solo per amministratori autorizzati.</h1><p className="mt-6 max-w-md text-base leading-7 text-white/65">Gestisci tenant, integrazioni e operatività ProntoAI24 da uno spazio protetto e centralizzato.</p><ul className="mt-9 grid gap-4 text-sm font-semibold text-white/85">{securityPoints.map((point) => <li key={point} className="flex items-center gap-3"><CheckCircle2 size={18} className="shrink-0 text-[var(--lime)]" />{point}</li>)}</ul></div></section><section className="px-7 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-14"><div className="max-w-md"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--blue)]">Accesso unificato</p><h2 className="mt-3 text-3xl font-bold text-[var(--ink)] sm:text-4xl">Bentornato.</h2><p className="mt-4 leading-7 text-[var(--muted)]">Accedi con le tue credenziali per entrare nella gestione Admin dei tenant.</p>{resetCompletato && <p role="status" className="mt-5 rounded-2xl bg-[#e5f8f6] px-4 py-3 text-sm font-semibold text-[var(--blue)]">Password aggiornata con successo. Effettua il login con le nuove credenziali.</p>}<form onSubmit={handleLogin} className="mt-8 grid gap-5"><label className="grid gap-2 text-sm font-bold text-[var(--ink)]">Email<input type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" placeholder="nome@azienda.it" className="min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base font-normal text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-[var(--cyan)] focus:ring-4 focus:ring-[var(--cyan)]/15" /></label><label className="grid gap-2 text-sm font-bold text-[var(--ink)]">Password<input type="password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Inserisci la password" className="min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base font-normal text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)]/60 focus:border-[var(--cyan)] focus:ring-4 focus:ring-[var(--cyan)]/15" /></label>{errore && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{errore}</p>}<button type="submit" disabled={caricamento} className="btn-primary mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white shadow-lg shadow-[#102a43]/15 transition hover:bg-[#173d58] disabled:cursor-not-allowed disabled:opacity-60">{caricamento ? 'Accesso in corso…' : 'Accedi al pannello Admin'} <LockKeyhole size={17} /></button></form><div className="mt-7 flex flex-col gap-3 border-t border-[var(--line)] pt-6 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between"><a href="mailto:supporto@prontoai24.it?subject=Recupero%20accesso%20Admin" className="text-[var(--blue)] hover:underline">Password dimenticata?</a><Link href="/" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Torna al sito principale</Link></div></div></section></div><p className="mt-7 text-center text-xs font-medium text-[var(--muted)]">Accesso riservato. Se visualizzi un problema, contatta il supporto ProntoAI24.</p></div></main>
}
