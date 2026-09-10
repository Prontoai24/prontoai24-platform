import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { captureObservedException, captureObservedMessage } from '@/lib/observability/sentry'

export const dynamic = 'force-dynamic'

function verifyTelnyxSignature(rawBody: string, request: Request) {
  const publicKey = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
  const signature = request.headers.get('telnyx-signature-ed25519') || request.headers.get('x-telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp') || request.headers.get('x-telnyx-timestamp')
  if (!publicKey || !signature || !timestamp) return false
  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false
  try {
    return crypto.verify(null, Buffer.from(`${timestamp}.${rawBody}`, 'utf8'), publicKey, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

function firstPhone(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return typeof row.phone_number === 'string' ? row.phone_number : typeof row.number === 'string' ? row.number : null
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: 'telnyx', endpoint: 'messaging' })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!verifyTelnyxSignature(rawBody, request)) return NextResponse.json({ error: 'Firma webhook Telnyx non valida' }, { status: 401 })

  try {
    const body = JSON.parse(rawBody) as Record<string, any>
    const eventType = String(body.data?.event_type || body.event_type || '')
    const payload = (body.data?.payload || body.payload || {}) as Record<string, any>
    if (!['message.received', 'message.finalized', 'message.sent', 'message.delivered', 'message.failed'].includes(eventType)) {
      return NextResponse.json({ received: true, ignored: eventType || 'unknown_event' })
    }

    const providerMessageId = String(payload.id || body.data?.id || body.id || '') || null
    const fromNumber = firstPhone(payload.from) || String(payload.from || '')
    const destinations = Array.isArray(payload.to) ? payload.to : [payload.to]
    const toNumber = firstPhone(destinations[0]) || String(payload.to || '')
    const text = typeof payload.text === 'string' ? payload.text : typeof payload.body === 'string' ? payload.body : ''
    if (!fromNumber || !toNumber) return NextResponse.json({ received: true, ignored: 'missing_phone_numbers' })

    const admin = createAdminClient()
    const { data: assignedNumber, error: lookupError } = await admin.from('phone_numbers').select('client_id, phone_number').eq('phone_number', toNumber).maybeSingle()
    if (lookupError) throw lookupError
    if (!assignedNumber) {
      await admin.from('audit_logs').insert({ action: 'telnyx.message.ignored', entity_type: 'telnyx', metadata: { eventType, providerMessageId, toNumber, reason: 'tenant non risolto' } })
      return NextResponse.json({ received: true, ignored: 'tenant_non_risolto' })
    }

    const clientId = assignedNumber.client_id
    if (providerMessageId) {
      const { data: existing } = await admin.from('sms_messages').select('id').eq('provider_message_id', providerMessageId).maybeSingle()
      if (existing) return NextResponse.json({ received: true, duplicate: true, client_id: clientId })
    }

    const status = eventType === 'message.delivered' ? 'delivered' : eventType === 'message.failed' ? 'failed' : eventType === 'message.sent' ? 'sent' : 'received'
    const { error: insertError } = await admin.from('sms_messages').insert({ client_id: clientId, from_number: fromNumber, to_number: toNumber, body: text, status, provider_message_id: providerMessageId, error_message: payload.errors?.[0]?.detail || null, updated_at: new Date().toISOString() })
    if (insertError) throw insertError

    await admin.from('audit_logs').insert({ action: 'telnyx.message.received', entity_type: 'telnyx', metadata: { clientId, eventType, providerMessageId, fromNumber, toNumber } })
    captureObservedMessage('Telnyx inbound message ricevuto', 'info', clientId, { eventType, providerMessageId })
    return NextResponse.json({ received: true, client_id: clientId, provider_message_id: providerMessageId })
  } catch (error) {
    captureObservedException(error, 'default', { provider: 'telnyx', endpoint: 'webhooks/ai/telnyx' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, { status: 500 })
  }
}
