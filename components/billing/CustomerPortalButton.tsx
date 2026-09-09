'use client'

import { useState } from 'react'

export default function CustomerPortalButton() {
  const [loading, setLoading] = useState(false)
  const openPortal = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Customer Portal non disponibile')
      window.location.assign(payload.url)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Errore apertura fatturazione')
    } finally {
      setLoading(false)
    }
  }
  return <button type="button" onClick={openPortal} disabled={loading} className="mt-5 rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Apertura…' : 'Gestisci abbonamento e fatture'}</button>
}
