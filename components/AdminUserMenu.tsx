'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminUserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function close(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function logout() {
    setLoading(true)
    const supabase = createClient()
    try { await supabase.auth.signOut() } finally {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => undefined)
      router.replace('/login')
      router.refresh()
    }
  }

  return <div ref={ref} className="relative"><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-[var(--cyan)]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] font-bold text-white">{(name || 'P').trim().charAt(0).toUpperCase()}</span><span className="hidden sm:block"><span className="block max-w-[140px] truncate text-xs font-bold">{name || 'Amministratore'}</span><span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{role}</span></span><ChevronDown size={16} className={`mr-1 transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl"><Link role="menuitem" href="/admin/profilo" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f7fbff]"><UserRound size={16} className="text-[var(--blue)]" /> Il mio Profilo</Link><button role="menuitem" type="button" onClick={logout} disabled={loading} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><LogOut size={16} /> {loading ? 'Disconnessione…' : 'Esci (Logout)'}</button></div>}</div>
}
