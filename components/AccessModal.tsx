'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck, UserRound, X } from 'lucide-react'

type AccessModalProps = {
  className?: string
  label?: string
}

export default function AccessModal({ className = '', label = 'Area riservata' }: AccessModalProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-modal-title"
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-white/70 bg-[var(--paper)] p-6 shadow-2xl shadow-black/25 sm:p-9"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi modale"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[var(--cyan)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
            >
              <X size={19} />
            </button>

            <div className="pr-10">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white">P</span>
                <span className="font-bold tracking-[-.04em] text-[var(--ink)]">ProntoAI<span className="text-[var(--cyan)]">24</span></span>
              </div>
              <h2 id="access-modal-title" className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">Accesso unificato</h2>
              <p className="mt-3 text-base leading-7 text-[var(--muted)]">Scegli l’area riservata a cui desideri accedere.</p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <a
                href="https://client.prontoai24.it"
                className="group rounded-[24px] border border-[var(--line)] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-[var(--cyan)] hover:shadow-xl hover:shadow-[#0b6e9e]/10 focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f8f6] text-[var(--blue)]"><UserRound size={23} /></span>
                <h3 className="mt-7 text-2xl font-bold text-[var(--ink)]">Cliente</h3>
                <p className="mt-3 min-h-[72px] leading-7 text-[var(--muted)]">Accedi alla dashboard di gestione dei tuoi assistenti vocali, chatbot e automazioni.</p>
                <span className="mt-6 inline-flex items-center gap-2 font-bold text-[var(--blue)] transition group-hover:gap-3">Apri Area Clienti <ArrowRight size={17} /></span>
              </a>

              <a
                href="https://admin.prontoai24.it"
                className="group rounded-[24px] bg-[var(--ink)] p-6 text-white transition duration-200 hover:-translate-y-1 hover:bg-[#173d58] hover:shadow-xl hover:shadow-[#0b2e44]/25 focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--lime)]"><ShieldCheck size={23} /></span>
                <h3 className="mt-7 text-2xl font-bold">Admin SaaS</h3>
                <p className="mt-3 min-h-[72px] leading-7 text-white/65">Accedi alla regia e alla gestione completa della piattaforma e delle integrazioni.</p>
                <span className="mt-6 inline-flex items-center gap-2 font-bold text-[var(--lime)] transition group-hover:gap-3">Apri Area Admin <ArrowRight size={17} /></span>
              </a>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
