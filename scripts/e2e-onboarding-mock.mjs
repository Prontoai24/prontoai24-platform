#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3100'
const targetNumber = process.env.E2E_TO_NUMBER || '+393358347560'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const suffix = Date.now().toString()
let clientId
let phoneId

async function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const { data: admin, error: adminError } = await supabase.from('profiles').select('id').eq('role', 'super_admin').limit(1).maybeSingle()
  if (adminError || !admin) throw new Error(`Super Admin fixture non disponibile: ${adminError?.message || 'nessun profilo'}`)

  const { data: client, error: clientError } = await supabase.from('clients').insert({ managed_by_admin: admin.id, company_name: `E2E-MOCK-${suffix}`, contact_email: `e2e-${suffix}@example.invalid`, contact_phone: targetNumber, billing_address: 'Via Test 1, Milano', status: 'in_setup' }).select('id').single()
  if (clientError) throw new Error(`Creazione client mock fallita: ${clientError.message}`)
  clientId = client.id

  const { data: phone, error: phoneError } = await supabase.from('phone_numbers').insert({ client_id: clientId, phone_number: `+3902${suffix.slice(-8)}`, telnyx_number_id: `mock-telnyx-number-${suffix}`, telnyx_order_id: `mock-order-${suffix}`, requirement_group_id: `mock-requirement-${suffix}`, messaging_profile_id: 'mock-messaging-profile', compliance_status: 'pending', status: 'pending', status_updated_at: new Date().toISOString() }).select('id, phone_number, telnyx_number_id, telnyx_order_id').single()
  if (phoneError) throw new Error(`Creazione numero mock fallita: ${phoneError.message}`)
  phoneId = phone.id

  const vapiAssistantId = `mock-vapi-assistant-${suffix}`
  const { error: vapiError } = await supabase.from('phone_numbers').update({ vapi_assistant_id: vapiAssistantId }).eq('id', phoneId)
  if (vapiError) throw new Error(`Associazione Vapi mock fallita: ${vapiError.message}`)

  const response = await fetch(`${baseUrl}/api/webhooks/telnyx`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { id: `mock-event-${suffix}`, event_type: 'number_order.completed', payload: { id: phone.telnyx_number_id, number_order_id: phone.telnyx_order_id, phone_number_id: phone.telnyx_number_id, status: 'active' } } }) })
  const webhookBody = await response.json().catch(() => ({}))
  assert(response.ok, `Webhook mock fallito (${response.status}): ${webhookBody.error || 'errore'}`)

  const { data: updatedPhone, error: updatedPhoneError } = await supabase.from('phone_numbers').select('status, compliance_status, vapi_assistant_id, telnyx_order_id').eq('id', phoneId).single()
  if (updatedPhoneError) throw new Error(updatedPhoneError.message)
  assert(updatedPhone.status === 'active', `Stato numero inatteso: ${updatedPhone.status}`)
  assert(updatedPhone.compliance_status === 'approved', `Stato compliance inatteso: ${updatedPhone.compliance_status}`)
  assert(updatedPhone.vapi_assistant_id === vapiAssistantId, 'vapi_assistant_id non associato')

  const { data: sms, error: smsError } = await supabase.from('sms_messages').select('status, from_number, to_number, provider_message_id, body').eq('client_id', clientId).eq('to_number', targetNumber).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (smsError) throw new Error(smsError.message)
  assert(sms, 'Nessun SMS mock registrato')
  assert(sms.status === 'sent', `Stato SMS inatteso: ${sms.status}`)
  assert(sms.provider_message_id?.startsWith('mock-sms-'), 'provider_message_id mock mancante')

  console.log(JSON.stringify({ ok: true, mode: 'mock', clientId, phone: updatedPhone, sms, webhook: webhookBody }, null, 2))
} finally {
  if (clientId) {
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) console.error(`WARN cleanup client ${clientId}: ${error.message}`)
    else console.log(`CLEANUP OK: client ${clientId} e dati correlati rimossi`)
  }
}
