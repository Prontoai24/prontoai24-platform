'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CambioPasswordObbligatorio() {
  const [nuovaPassword, setNuovaPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)

    if (nuovaPassword.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.')
      return
    }
    if (nuovaPassword !== conferma) {
      setErrore('Le password non coincidono.')
      return
    }

    setCaricamento(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: erroreUpdate } = await supabase.auth.updateUser({ password: nuovaPassword })

    if (erroreUpdate) {
      setErrore(erroreUpdate.message)
      setCaricamento(false)
      return
    }

    // Rimuove l'obbligo di cambio password
    if (user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
    }

    router.refresh()
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Imposta una nuova password</h1>
      <p>Per motivi di sicurezza devi cambiare la password temporanea prima di continuare.</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Nuova password</label>
          <input
            type="password"
            value={nuovaPassword}
            onChange={(e) => setNuovaPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Conferma password</label>
          <input
            type="password"
            value={conferma}
            onChange={(e) => setConferma(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {errore && <p style={{ color: 'red' }}>{errore}</p>}
        <button type="submit" disabled={caricamento} style={{ width: '100%', padding: 10 }}>
          {caricamento ? 'Salvataggio…' : 'Imposta password e continua'}
        </button>
      </form>
    </div>
  )
}
