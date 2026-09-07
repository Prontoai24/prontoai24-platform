'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, ShieldCheck, UserRound, X } from 'lucide-react'

type AccessModalProps = { className?: string; label?: string }

export default function AccessModal({ className = '', label = 'Area riservata' }: AccessModalProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const modal = open ? <div className="fixed inset-0 z-[999] flex min-h-screen items-center justify-center overflow-y-auto bg-[var(--ink)]/75 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
    <section role="dialog" aria-modal="true" aria-labelledby="access-modal-title" className="relative z-[1000] my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-[28px] border border-white/80 bg-[var(--paper)] p-5 shadow-2xl shadow-black/40 sm:max-h-[calc(100vh-3rem)] sm:rounded-[32px] sm:p-9">
      <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi modale" className="absolute right-3 top-3 z-[1001] flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] shadow-sm transition hover:border-[var(--cyan)] hover:text-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)] sm:right-5 sm:top-5"><X size={20} /></button>
      <div className="shrink-0 pr-12 sm:pr-14"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white">P</span><span className="font-bold tracking-[-.04em] text-[var(--ink)]">ProntoAI<span className="text-[var(--cyan)]">24</span></span></div><h2 id="access-modal-title" className="m-0 max-w-full text-2xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">Accesso unificato</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">Scegli l’area riservata a cui desideri accedere.</p></div>
      <div className="mt-6 grid min-h-0 grid-cols-1 gap-4 md:mt-8 md:grid-cols-2"><a href="https://client.prontoai24.it" className="group flex min-h-[220px] flex-col rounded-[22px] border border-[var(--line)] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[var(--cyan)] hover:shadow-xl hover:shadow-[#0b6e9e]/10 focus:outline-none focus:ring-2 focus:ring-[var(--cyan)] sm:min-h-[250px] sm:p-6"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e5f8f6] text-[var(--blue)]"><UserRound size={23} /></span><h3 className="mt-5 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">Cliente</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">Accedi alla dashboard di gestione dei tuoi assistenti vocali, chatbot e automazioni.</p><span className="mt-auto flex items-center gap-2 pt-6 font-bold text-[var(--blue)] transition group-hover:gap-3">Apri Area Clienti <ArrowRight size={17} /></span></a><a href="https://admin.prontoai24.it" className="group flex min-h-[220px] flex-col rounded-[22px] bg-[var(--ink)] p-5 text-white transition duration-200 hover:-translate-y-1 hover:bg-[#173d58] hover:shadow-xl hover:shadow-[#0b2e44]/25 focus:outline-none focus:ring-2 focus:ring-[var(--cyan)] sm:min-h-[250px] sm:p-6"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--lime)]"><ShieldCheck size={23} /></span><h3 className="mt-5 text-xl font-bold leading-tight sm:text-2xl">Admin SaaS</h3><p className="mt-3 text-sm leading-6 text-white/70 sm:text-base sm:leading-7">Accedi alla regia e alla gestione completa della piattaforma e delle integrazioni.</p><span className="mt-auto flex items-center gap-2 pt-6 font-bold text-[var(--lime)] transition group-hover:gap-3">Apri Area Admin <ArrowRight size={17} /></span></a></div>
    </section>
  </div> : null

  return <><button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog" aria-expanded={open}>{label}</button>{mounted && modal ? createPortal(modal, document.body) : null}</>
}
