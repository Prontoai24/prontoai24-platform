import { createAdminClient } from '@/lib/supabase/server'

export type SendTransactionalSmsInput = {
  clientId: string
  toNumber: string
  body: string
  fromNumber?: string
}

export async function sendTransactionalSms(input: SendTransactionalSmsInput) {
  const admin = createAdminClient()
  const { data: phone, error: phoneError } = await admin
    .from('phone_numbers')
    .select('phone_number, messaging_profile_id, status')
    .eq('client_id', input.clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (phoneError) throw new Error(`Numero tenant non leggibile: ${phoneError.message}`)

  const fromNumber = input.fromNumber || phone?.phone_number
  const messagingProfileId = phone?.messaging_profile_id || process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!fromNumber) throw new Error('Nessun numero mittente attivo per il tenant')
  if (!messagingProfileId) throw new Error('Messaging profile Telnyx non configurato')
  if (!input.toNumber.startsWith('+')) throw new Error('Il destinatario deve essere in formato internazionale')
  if (!input.body.trim() || input.body.length > 1600) throw new Error('Il testo SMS è obbligatorio e non può superare 1600 caratteri')

  const { data: queued, error: queueError } = await admin.from('sms_messages').insert({ client_id: input.clientId, from_number: fromNumber, to_number: input.toNumber, body: input.body, status: 'queued' }).select('id').single()
  if (queueError) throw new Error(`Registrazione SMS non riuscita: ${queueError.message}`)

  try {
    let providerMessageId: string | null
    if (process.env.TELNYX_MOCK_MODE === 'true') {
      providerMessageId = `mock-sms-${queued.id}`
    } else {
      const key = process.env.TELNYX_API_KEY
      if (!key) throw new Error('TELNYX_API_KEY non configurata')
      const response = await fetch('https://api.telnyx.com/v2/messages', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: fromNumber, to: input.toNumber, text: input.body, messaging_profile_id: messagingProfileId }), cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.errors?.[0]?.detail || body?.error || `Telnyx ${response.status}`)
      const message = body.data || body
      providerMessageId = message.id || null
    }
    await admin.from('sms_messages').update({ status: 'sent', provider_message_id: providerMessageId, updated_at: new Date().toISOString() }).eq('id', queued.id)
    return { id: queued.id, providerMessageId, fromNumber, messagingProfileId, mock: process.env.TELNYX_MOCK_MODE === 'true' }
  } catch (error) {
    await admin.from('sms_messages').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Invio SMS fallito', updated_at: new Date().toISOString() }).eq('id', queued.id)
    throw error
  }
}
