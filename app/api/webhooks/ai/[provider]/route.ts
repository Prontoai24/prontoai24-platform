import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { captureObservedException, captureObservedMessage } from '@/lib/observability/sentry'
import { recordVoiceEvent } from '@/lib/observability/langfuse'

export const dynamic = 'force-dynamic'

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0) || null
}

function numberValue(...values: unknown[]) {
  const value = values.find((candidate) => candidate !== undefined && candidate !== null && candidate !== '')
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function transcriptText(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return ''
    const row = item as Record<string, unknown>
    return firstString(row.transcript, row.text, row.content) || ''
  }).filter(Boolean).join('\n') || null
}

export async function POST(request: Request, context: { params: { provider: string } }) {
  const provider = context.params.provider.toLowerCase()
  if (!['vapi', 'telnyx', 'whatsapp'].includes(provider)) return NextResponse.json({ error: 'Provider non supportato' }, { status: 404 })

  const expected = process.env.AI_WEBHOOK_SECRET
  const receivedSecret = request.headers.get('x-prontoai-webhook-secret') || request.headers.get('x-vapi-secret')
  if (expected && receivedSecret !== expected) return NextResponse.json({ error: 'Firma webhook non valida' }, { status: 401 })

  try {
    const payload = await request.json() as Record<string, any>
    const adminClient = createAdminClient()
    if (provider !== 'vapi') {
      await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.received`, entity_type: provider, metadata: { event: payload.type || payload.event || null } })
      return NextResponse.json({ received: true })
    }

    const message = (payload.message || payload) as Record<string, any>
    const call = (message.call || {}) as Record<string, any>
    const artifact = (message.artifact || call.artifact || {}) as Record<string, any>
    const assistant = (message.assistant || call.assistant || {}) as Record<string, any>
    const phone = (message.phoneNumber || call.phoneNumber || {}) as Record<string, any>
    const event = firstString(message.type, payload.type, payload.event) || 'unknown'
    const providerCallId = firstString(call.id, message.callId, payload.callId)
    const assistantId = firstString(call.assistantId, call.assistant_id, assistant.id, payload.assistantId, payload.metadata?.assistantId)
    const phoneId = firstString(call.phoneNumberId, call.phone_number_id, phone.id, payload.phoneNumberId)
    const phoneNumber = firstString(phone.number, call.customer?.number, call.from_number, call.to_number)
    let orgId = firstString(payload.org_id, payload.client_id, payload.tenantId, payload.tenant_id, payload.metadata?.org_id, payload.metadata?.client_id, message.metadata?.org_id, message.metadata?.client_id)

    if (!orgId && (assistantId || phoneId || phoneNumber)) {
      const filters = [
        phoneId ? `vapi_phone_id.eq.${phoneId}` : null,
        assistantId ? `vapi_assistant_id.eq.${assistantId}` : null,
        phoneNumber ? `phone_number.eq.${phoneNumber}` : null,
      ].filter(Boolean).join(',')
      if (filters) {
        const { data: mapped } = await adminClient.from('phone_numbers').select('client_id').or(filters).maybeSingle()
        orgId = mapped?.client_id || null
      }
    }

    if (!orgId) {
      captureObservedMessage('Vapi webhook tenant non risolto', 'warning', 'default', { event, providerCallId, assistantId, phoneId })
      await adminClient.from('audit_logs').insert({ action: 'vapi.webhook.ignored', entity_type: 'vapi', metadata: { event, providerCallId, assistantId, phoneId, reason: 'tenant non risolto' } })
      return NextResponse.json({ received: true, ignored: 'tenantId/org_id non risolto' })
    }

    const conversationId = firstString(call.conversationId, call.conversation_id, message.conversationId, payload.conversationId, providerCallId)!
    const transcript = transcriptText(message.transcript || call.transcript || artifact.transcript || artifact.transcriptText || artifact.messages)
    const recording = (artifact.recording || {}) as Record<string, any>
    const recordingUrl = firstString(recording.url, recording.mono?.url, recording.stereoUrl, call.recording_url, call.recordingUrl)
    const duration = Math.round(numberValue(call.durationSeconds, call.duration_seconds, call.duration, artifact.durationSeconds))
    const startedAt = isoDate(call.startedAt || call.started_at || message.startedAt)
    const endedAt = isoDate(call.endedAt || call.ended_at || message.endedAt)
    const endedReason = firstString(message.endedReason, call.endedReason, call.ended_reason)

    const { data: existing } = await adminClient.from('calls').select('id').eq('org_id', orgId).eq('provider_call_id', providerCallId).maybeSingle()
    const callRecord = {
      org_id: orgId,
      provider_call_id: providerCallId,
      conversation_id: conversationId,
      recording_url: recordingUrl,
      duration,
      started_at: startedAt,
      ended_at: endedAt,
      direction: firstString(call.direction) || 'inbound',
      from_number: firstString(call.customer?.number, call.from_number),
      to_number: firstString(phone.number, call.to_number),
      status: event,
      ended_reason: endedReason,
      updated_at: new Date().toISOString(),
    }
    const callQuery = existing
      ? adminClient.from('calls').update(callRecord).eq('id', existing.id)
      : adminClient.from('calls').insert(callRecord)
    const { error: callError } = await callQuery
    if (callError) throw callError

    if (transcript || event === 'transcript' || event === 'end-of-call-report') {
      const { data: conversation } = await adminClient.from('conversations').select('transcript').eq('org_id', orgId).eq('conversation_id', conversationId).maybeSingle()
      const mergedTranscript = transcript || conversation?.transcript || null
      const { error: conversationError } = await adminClient.from('conversations').upsert({ org_id: orgId, conversation_id: conversationId, channel: 'voice', transcript: mergedTranscript, updated_at: new Date().toISOString() }, { onConflict: 'org_id,conversation_id' })
      if (conversationError) throw conversationError
    }

    await adminClient.from('audit_logs').insert({ action: `vapi.webhook.${event}`, entity_type: 'vapi', metadata: { orgId, providerCallId, conversationId, duration, hasTranscript: Boolean(transcript), hasRecording: Boolean(recordingUrl) } })
    captureObservedMessage(`Vapi voice event: ${event}`, 'info', orgId, { providerCallId, conversationId, duration })
    await recordVoiceEvent(event, { orgId, sessionId: conversationId, feature: 'vapi-voice' }, { providerCallId, duration, hasTranscript: Boolean(transcript), hasRecording: Boolean(recordingUrl) })
    return NextResponse.json({ received: true, org_id: orgId, conversation_id: conversationId, event })
  } catch (error) {
    captureObservedException(error, 'default', { provider, endpoint: 'webhooks/ai' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, { status: 500 })
  }
}
