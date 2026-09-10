import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { captureObservedException, captureObservedMessage } from '@/lib/observability/sentry'
import { recordChannelEvent, recordVoiceEvent } from '@/lib/observability/langfuse'
import { buildKnowledgePrompt, generateKnowledgeReply } from '@/lib/knowledge/rag'
import { inngest } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

type JsonObject = Record<string, any>

type RateEntry = { count: number; resetAt: number }
const rateEntries = new Map<string, RateEntry>()

function rateLimit(request: Request, provider: string) {
  const max = Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 120)
  const windowMs = Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000)
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown'
  const key = `${provider}:${ip}`
  const now = Date.now()
  const current = rateEntries.get(key)
  if (!current || current.resetAt <= now) {
    rateEntries.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  current.count += 1
  if (current.count > max) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  }
  return null
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function validHmac(rawBody: string, received: string | null, secret: string | undefined) {
  if (!secret || !received) return false
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const normalized = received.trim().replace(/^sha256=/i, '')
  return safeEqual(normalized.toLowerCase(), digest.toLowerCase())
}

function authenticatedWebhook(provider: string, request: Request, rawBody: string) {
  const sharedSecret = process.env.AI_WEBHOOK_SECRET
  const sharedReceived = request.headers.get('x-prontoai-webhook-secret') || request.headers.get('x-webhook-secret')
  const allowFallback = process.env.WEBHOOK_ALLOW_SHARED_SECRET_FALLBACK === 'true'
  const sharedValid = Boolean(sharedSecret && sharedReceived && safeEqual(sharedReceived, sharedSecret))

  if (provider === 'whatsapp') {
    const signature = request.headers.get('x-hub-signature-256')
    const hmacValid = validHmac(rawBody, signature, process.env.WHATSAPP_APP_SECRET)
    return hmacValid || (allowFallback && sharedValid)
  }
  if (provider === 'vapi') {
    const signature = request.headers.get('x-vapi-signature') || request.headers.get('x-signature')
    const hmacValid = validHmac(rawBody, signature, process.env.VAPI_WEBHOOK_SIGNING_SECRET || process.env.VAPI_WEBHOOK_SECRET)
    const legacyHeader = request.headers.get('x-vapi-secret')
    return hmacValid || (allowFallback && sharedValid) || (allowFallback && Boolean(sharedSecret && legacyHeader && safeEqual(legacyHeader, sharedSecret)))
  }
  if (provider === 'webchat') {
    const publicKey = process.env.NEXT_PUBLIC_WEBCHAT_PUBLIC_KEY
    const receivedKey = request.headers.get('x-webchat-public-key')
    return Boolean(publicKey && receivedKey && safeEqual(receivedKey, publicKey)) || sharedValid
  }
  return sharedValid
}

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

function resolveOrgFromPayload(payload: JsonObject, message: JsonObject) {
  return firstString(
    payload.org_id,
    payload.client_id,
    payload.tenantId,
    payload.tenant_id,
    payload.metadata?.org_id,
    payload.metadata?.client_id,
    message.metadata?.org_id,
    message.metadata?.client_id,
  )
}

async function handleVoice(payload: JsonObject, adminClient: ReturnType<typeof createAdminClient>) {
  const message = (payload.message || payload) as JsonObject
  const call = (message.call || {}) as JsonObject
  const artifact = (message.artifact || call.artifact || {}) as JsonObject
  const assistant = (message.assistant || call.assistant || {}) as JsonObject
  const phone = (message.phoneNumber || call.phoneNumber || {}) as JsonObject
  const event = firstString(message.type, payload.type, payload.event) || 'unknown'
  const providerCallId = firstString(call.id, message.callId, payload.callId)
  const assistantId = firstString(call.assistantId, call.assistant_id, assistant.id, payload.assistantId, payload.metadata?.assistantId)
  const phoneId = firstString(call.phoneNumberId, call.phone_number_id, phone.id, payload.phoneNumberId)
  const phoneNumber = firstString(phone.number, call.customer?.number, call.from_number, call.to_number)
  let orgId = resolveOrgFromPayload(payload, message)

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
  const recording = (artifact.recording || {}) as JsonObject
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
  const callQuery = existing ? adminClient.from('calls').update(callRecord).eq('id', existing.id) : adminClient.from('calls').insert(callRecord)
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
  if (event === 'end-of-call-report' || event === 'call.ended' || event === 'call-ended') {
    await inngest.send({ name: 'vapi/call.ended', data: { org_id: orgId, duration_seconds: duration, provider_call_id: providerCallId } })
  }
  const ragSystemPrompt = transcript ? await buildKnowledgePrompt(orgId, transcript, 'Sei l’assistente vocale di ProntoAI24. Rispondi in italiano e usa solo informazioni verificate del tenant.') : null
  return NextResponse.json({ received: true, org_id: orgId, conversation_id: conversationId, event, rag_system_prompt: ragSystemPrompt })
}

async function handleMessaging(provider: 'whatsapp' | 'webchat', payload: JsonObject, adminClient: ReturnType<typeof createAdminClient>) {
  const whatsappValue = payload.entry?.[0]?.changes?.[0]?.value as JsonObject | undefined
  const whatsappMetadata = (whatsappValue?.metadata || {}) as JsonObject
  const whatsappStatus = provider === 'whatsapp' ? (whatsappValue?.statuses?.[0] as JsonObject | undefined) : undefined
  if (whatsappStatus?.id) {
    const statusOrg = firstString(payload.org_id, whatsappMetadata.org_id)
    let orgId = statusOrg
    if (!orgId && whatsappMetadata.phone_number_id) {
      const { data: mapped } = await adminClient.from('tenant_channel_settings').select('org_id').eq('provider', 'meta').eq('whatsapp_phone_number_id', String(whatsappMetadata.phone_number_id)).eq('is_active', true).maybeSingle()
      orgId = mapped?.org_id || null
    }
    if (orgId) await adminClient.from('messages').update({ status: firstString(whatsappStatus.status) || 'updated', metadata: { provider: 'meta', status: whatsappStatus } }).eq('provider', 'whatsapp').eq('provider_message_id', whatsappStatus.id).eq('org_id', orgId)
    return NextResponse.json({ received: true, status: whatsappStatus.status || 'updated', org_id: orgId })
  }
  const message = (provider === 'whatsapp'
    ? payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || payload.message || payload.messages?.[0] || payload
    : payload.message || payload) as JsonObject
  let orgId = resolveOrgFromPayload(payload, message)
  const providerMessageId = firstString(message.id, message.message_id, payload.message_id, payload.id)
  const sender = firstString(message.from, message.sender?.id, message.sender?.phone, payload.from, payload.sender)
  const recipient = firstString(message.to, message.recipient?.id, payload.to, payload.recipient)
  const body = firstString(message.text?.body, message.text, message.body, message.content?.text, payload.text, payload.body) || ''
  const occurredAt = isoDate(message.timestamp || message.created_at || payload.timestamp) || new Date().toISOString()

  const metaPhoneNumberId = firstString(whatsappMetadata.phone_number_id, message.metadata?.phone_number_id, payload.phone_number_id)
  if (!orgId && provider === 'whatsapp' && metaPhoneNumberId) {
    const { data: mapped } = await adminClient.from('tenant_channel_settings').select('org_id').eq('provider', 'meta').eq('whatsapp_phone_number_id', metaPhoneNumberId).eq('is_active', true).maybeSingle()
    orgId = mapped?.org_id || null
  }
  if (!orgId && provider === 'whatsapp' && (recipient || sender)) {
    const phone = recipient || sender
    const { data: mapped } = await adminClient.from('phone_numbers').select('client_id').eq('phone_number', phone).maybeSingle()
    orgId = mapped?.client_id || null
  }

  if (!orgId) {
    captureObservedMessage(`${provider} webhook tenant non risolto`, 'warning', 'default', { providerMessageId, sender, recipient })
    await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.ignored`, entity_type: provider, metadata: { providerMessageId, reason: 'org_id non risolto' } })
    return NextResponse.json({ received: true, ignored: 'org_id non risolto' })
  }

  if (providerMessageId) {
    const { data: duplicate } = await adminClient.from('messages').select('id').eq('provider', provider).eq('provider_message_id', providerMessageId).maybeSingle()
    if (duplicate) return NextResponse.json({ received: true, duplicate: true, org_id: orgId })
  }

  const conversationExternalId = firstString(
    payload.conversation_id,
    payload.conversationId,
    message.conversation_id,
    message.conversationId,
    message.context?.conversation_id,
    sender ? `${provider}:${sender}` : providerMessageId,
  )!

  const { data: existingConversation } = await adminClient.from('conversations').select('id,transcript').eq('org_id', orgId).eq('conversation_id', conversationExternalId).maybeSingle()
  const mergedTranscript = [existingConversation?.transcript, body].filter(Boolean).join('\n') || null
  const conversationPayload = { org_id: orgId, conversation_id: conversationExternalId, channel: provider, transcript: mergedTranscript, updated_at: new Date().toISOString() }
  const conversationQuery = existingConversation
    ? adminClient.from('conversations').update(conversationPayload).eq('id', existingConversation.id).select('id').single()
    : adminClient.from('conversations').insert(conversationPayload).select('id').single()
  const { data: conversation, error: conversationError } = await conversationQuery
  if (conversationError || !conversation) throw conversationError || new Error('Conversazione non creata')

  const { error: messageError } = await adminClient.from('messages').insert({
    org_id: orgId,
    conversation_id: conversation.id,
    provider,
    provider_message_id: providerMessageId,
    direction: firstString(message.direction, payload.direction) === 'outbound' ? 'outbound' : 'inbound',
    sender,
    recipient,
    body,
    status: firstString(message.status, payload.status) || 'received',
    metadata: { event: payload.type || payload.event || null, raw_type: message.type || null },
    occurred_at: occurredAt,
  })
  if (messageError) throw messageError

  await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.message`, entity_type: provider, metadata: { orgId, conversationId: conversationExternalId, providerMessageId } })
  captureObservedMessage(`${provider} message received`, 'info', orgId, { conversationId: conversationExternalId, providerMessageId })
  await recordChannelEvent(provider, 'message.received', { orgId, sessionId: conversationExternalId, feature: `${provider}-inbox` }, { providerMessageId, bodyLength: body.length })
  if (provider === 'whatsapp') {
    await inngest.send({ name: 'whatsapp/message.sent', data: { org_id: orgId, provider_message_id: providerMessageId } })
  }
  const generated = await generateKnowledgeReply(orgId, body)
  if (generated.usage) {
    await adminClient.from('ai_usage_events').insert({
      org_id: orgId,
      channel: provider,
      provider: 'openai',
      model: generated.usage.model,
      request_id: providerMessageId || crypto.randomUUID(),
      input_tokens: generated.usage.inputTokens,
      output_tokens: generated.usage.outputTokens,
      total_tokens: generated.usage.totalTokens,
      latency_ms: generated.usage.latencyMs,
      cost_usd: generated.usage.costUsd,
      status: generated.reply ? 'success' : 'error',
      metadata: { rag_matches: generated.matches },
    })
  }
  await recordChannelEvent(provider, 'rag.reply.generated', { orgId, sessionId: conversationExternalId, feature: `${provider}-rag` }, { providerMessageId, matches: generated.matches, hasReply: Boolean(generated.reply) })
  return NextResponse.json({ received: true, org_id: orgId, conversation_id: conversationExternalId, message_id: providerMessageId, reply: generated.reply, rag_matches: generated.matches })
}

export async function POST(request: Request, context: { params: { provider: string } }) {
  const provider = context.params.provider.toLowerCase()
  if (!['vapi', 'telnyx', 'whatsapp', 'webchat'].includes(provider)) return NextResponse.json({ error: 'Provider non supportato' }, { status: 404 })

  const retryAfter = rateLimit(request, provider)
  if (retryAfter) return NextResponse.json({ error: 'Webhook rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })

  try {
    const rawBody = await request.text()
    if (!authenticatedWebhook(provider, request, rawBody)) return NextResponse.json({ error: 'Firma webhook non valida' }, { status: 401 })
    const payload = JSON.parse(rawBody) as JsonObject
    const adminClient = createAdminClient()
    if (provider === 'vapi') return handleVoice(payload, adminClient)
    if (provider === 'whatsapp' || provider === 'webchat') return handleMessaging(provider, payload, adminClient)
    await adminClient.from('audit_logs').insert({ action: `${provider}.webhook.received`, entity_type: provider, metadata: { event: payload.type || payload.event || null } })
    return NextResponse.json({ received: true })
  } catch (error) {
    captureObservedException(error, 'default', { provider, endpoint: 'webhooks/ai' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, { status: 500 })
  }
}
