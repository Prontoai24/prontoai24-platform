'use client'

import { useRef, useState, useTransition } from 'react'
import { saveWhatsAppSettings } from './actions'

type Props = { initialPhoneNumberId?: string; initialWabaId?: string; isActive?: boolean }

export default function WhatsAppSettingsForm({ initialPhoneNumberId = '', initialWabaId = '', isActive = false }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const submit = (formData: FormData) => startTransition(async () => {
    setMessage('')
    const result = await saveWhatsAppSettings(formData)
    setMessage(result.success ? 'Configurazione salvata.' : result.error || 'Errore di salvataggio')
    if (result.success && formRef.current) formRef.current.reset()
  })
  return <form ref={formRef} action={submit} className="mt-6 space-y-5 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
    <div><h1 className="text-2xl font-bold">WhatsApp Business</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Collega il tuo numero Meta. Il token viene cifrato server-side e non viene mai mostrato dopo il salvataggio.</p></div>
    <label className="block text-sm font-semibold">Phone Number ID<input name="phoneNumberId" required defaultValue={initialPhoneNumberId} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label>
    <label className="block text-sm font-semibold">WABA ID<input name="wabaId" required defaultValue={initialWabaId} className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label>
    <label className="block text-sm font-semibold">Access Token Meta<input name="accessToken" type="password" autoComplete="new-password" placeholder="Lascia vuoto per mantenere quello attuale" className="mt-2 w-full rounded-2xl border border-[var(--line)] px-4 py-3" /></label>
    <label className="flex items-center gap-3 text-sm font-semibold"><input name="isActive" type="checkbox" defaultChecked={isActive} /> Abilita il canale WhatsApp</label>
    <button type="submit" disabled={pending} className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Salvataggio…' : 'Salva configurazione'}</button>
    {message && <p className="text-sm font-semibold text-[var(--blue)]">{message}</p>}
  </form>
}
