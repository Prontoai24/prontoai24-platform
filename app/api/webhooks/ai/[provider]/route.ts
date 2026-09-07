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
  const clientId = payload.client_id || payload.metadata?.client_id
  if (!clientId) return NextResponse.json({ received: true, ignored: 'client_id mancante' })

  if (provider === 'vapi') {
    const call = payload.call || payload
    const { error } = await adminClient.from('call_logs').insert({ client_id: clientId, direction: call.direction || 'inbound', from_number: call.customer?.number || call.from_number, to_number: call.phoneNumber?.number || call.to_number, duration_seconds: Math.round(Number(call.duration_seconds || call.duration || 0)), recording_url: call.recording_url || call.recordingUrl, transcript: call.transcript || call.artifact?.transcript, outcome: call.endedReason || call.outcome })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (provider === 'whatsapp') {
    const message = payload.message || payload.messages?.[0] || payload
    const { error } = await adminClient.from('whatsapp_messages').insert({ client_id: clientId, direction: message.direction || 'inbound', phone_number: message.from || message.phone_number, body: message.text?.body || message.body || '', status: message.status || 'received', provider_message_id: message.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.received`, entity_type: provider, metadata: { clientId, event: payload.type || payload.event || null } })
  return NextResponse.json({ received: true })
}
