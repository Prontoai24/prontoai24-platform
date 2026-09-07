import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: { provider: string } }) {
  const expected = process.env.AI_WEBHOOK_SECRET
  if (expected && request.headers.get('x-prontoai-webhook-secret') !== expected) return NextResponse.json({ error: 'Firma webhook non valida' }, { status: 401 })
  const provider = context.params.provider.toLowerCase()
  if (!['vapi', 'telnyx', 'whatsapp'].includes(provider)) return NextResponse.json({ error: 'Provider non supportato' }, { status: 404 })
  const payload = await request.json()
  const adminClient = createAdminClient()
  const message = provider === 'vapi' ? (payload.message || payload) : payload
  const call = provider === 'vapi' ? (message.call || {}) : message
  const artifact = provider === 'vapi' ? (message.artifact || call.artifact || {}) : {}
  const assistant = provider === 'vapi' ? (message.assistant || call.assistant || {}) : {}
  const phone = provider === 'vapi' ? (message.phoneNumber || call.phoneNumber || {}) : {}
  const assistantId = call.assistantId || call.assistant_id || assistant.id || payload.assistantId || payload.metadata?.assistantId
  const phoneId = call.phoneNumberId || call.phone_number_id || phone.id || payload.phoneNumberId
  const phoneNumber = phone.number || call.customer?.number || call.from_number || call.to_number
  let clientId = payload.client_id || payload.tenantId || payload.tenant_id || payload.metadata?.client_id || payload.metadata?.tenantId || message.metadata?.client_id || message.metadata?.tenantId

  if (!clientId && provider === 'vapi' && (assistantId || phoneId || phoneNumber)) {
    const filters = [phoneId ? `vapi_phone_id.eq.${phoneId}` : null, assistantId ? `vapi_assistant_id.eq.${assistantId}` : null, phoneNumber ? `phone_number.eq.${phoneNumber}` : null].filter(Boolean).join(',')
    if (filters) {
      const { data: mapped } = await adminClient.from('phone_numbers').select('client_id').or(filters).maybeSingle()
      clientId = mapped?.client_id || null
    }
  }
  if (!clientId) {
    await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.received`, entity_type: provider, metadata: { event: message.type || payload.type || payload.event || null, assistantId, phoneId, ignored: 'tenant non risolto' } })
    return NextResponse.json({ received: true, ignored: 'tenantId/client_id non risolto' })
  }

  if (provider === 'vapi') {
    const recording = artifact.recording || {}
    const transcript = message.transcript || call.transcript || artifact.transcript || artifact.transcriptText
    const duration = call.durationSeconds || call.duration_seconds || call.duration || artifact.durationSeconds || 0
    const { error } = await adminClient.from('call_logs').insert({ client_id: clientId, direction: call.direction || 'inbound', from_number: call.customer?.number || call.from_number, to_number: phone.number || call.to_number, duration_seconds: Math.round(Number(duration)), recording_url: recording.url || recording.mono?.url || recording.stereoUrl || call.recording_url || call.recordingUrl, transcript, outcome: message.endedReason || call.endedReason || call.outcome || message.type || payload.type || payload.event })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (provider === 'whatsapp') {
    const sms = payload.message || payload.messages?.[0] || payload
    const { error } = await adminClient.from('whatsapp_messages').insert({ client_id: clientId, direction: sms.direction || 'inbound', phone_number: sms.from || sms.phone_number, body: sms.text?.body || sms.body || '', status: sms.status || 'received', provider_message_id: sms.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.received`, entity_type: provider, metadata: { clientId, event: message.type || payload.type || payload.event || null, assistantId, phoneId } })
  return NextResponse.json({ received: true, clientId })
}
