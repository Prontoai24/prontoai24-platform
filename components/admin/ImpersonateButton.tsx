'use client'

import { useState } from 'react'

export default function ImpersonateButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false)
  const handleClick = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
      const payload = await response.json() as { actionLink?: string; error?: string }
      if (!response.ok || !payload.actionLink) throw new Error(payload.error || 'Link non disponibile')
      window.open(payload.actionLink, '_blank', 'noopener,noreferrer')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Errore durante l’impersonation')
    } finally {
      setLoading(false)
    }
  }
  return <button type="button" onClick={handleClick} disabled={loading} className="rounded-full border border-[#e6a33b] px-3 py-2 text-xs font-bold text-[#9a5b00] transition hover:bg-[#fff4df] disabled:opacity-50">{loading ? 'Generazione…' : 'Accesso supporto'}</button>
}
