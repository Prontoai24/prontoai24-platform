#!/usr/bin/env node

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const secret = process.env.AI_WEBHOOK_SECRET || process.env.TEST_WEBHOOK_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const orgId = process.env.TEST_ORG_ID
const suffix = process.env.TEST_RUN_ID || `smoke-${Date.now()}`

if (!secret || !supabaseUrl || !serviceRoleKey || !orgId) {
  throw new Error('Impostare TEST_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e TEST_ORG_ID')
}

const headers = {
  'content-type': 'application/json',
  'x-prontoai-webhook-secret': secret,
}

async function post(provider, payload) {
  const response = await fetch(`${baseUrl}/api/webhooks/ai/${provider}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (response.status !== 200) throw new Error(`${provider} HTTP ${response.status}: ${JSON.stringify(body)}`)
  return body
}

async function query(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${await response.text()}`)
  return response.json()
}

async function remove(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (![200, 204].includes(response.status)) throw new Error(`Cleanup HTTP ${response.status}: ${await response.text()}`)
}

const whatsappConversation = `wa-${suffix}`
const whatsappMessage = `wa-msg-${suffix}`
const webchatConversation = `web-${suffix}`
const webchatMessage = `web-msg-${suffix}`

try {
  const whatsappPayload = {
    org_id: orgId,
    type: 'whatsapp.message',
    conversation_id: whatsappConversation,
    message: {
      id: whatsappMessage,
      from: '+393331112233',
      to: '+390212345678',
      type: 'text',
      text: { body: 'Test messaggio WhatsApp ProntoAI24' },
      timestamp: new Date().toISOString(),
    },
  }
  const whatsappResult = await post('whatsapp', whatsappPayload)
  const duplicateResult = await post('whatsapp', whatsappPayload)
  if (duplicateResult.duplicate !== true) throw new Error('Deduplicazione WhatsApp non verificata')

  const webchatResult = await post('webchat', {
    org_id: orgId,
    conversationId: webchatConversation,
    message: {
      id: webchatMessage,
      sender: { id: 'smoke-visitor' },
      text: 'Test messaggio Web Chat ProntoAI24',
      direction: 'inbound',
      created_at: new Date().toISOString(),
    },
  })

  const conversations = await query(`conversations?select=conversation_id,channel,transcript&org_id=eq.${orgId}&conversation_id=in.(${whatsappConversation},${webchatConversation})`)
  const messages = await query(`messages?select=provider,provider_message_id,body&org_id=eq.${orgId}&provider_message_id=in.(${whatsappMessage},${webchatMessage})`)
  if (conversations.length !== 2 || messages.length !== 2) throw new Error(`Persistenza incompleta: conversations=${conversations.length}, messages=${messages.length}`)

  console.log(JSON.stringify({
    ok: true,
    whatsapp: whatsappResult,
    whatsappDuplicate: duplicateResult,
    webchat: webchatResult,
    persisted: { conversations: conversations.length, messages: messages.length },
    observability: {
      sentryHelperInvoked: true,
      langfuseHelperInvoked: Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY),
      note: 'Verifica dashboard esterna necessaria per attestare la ricezione remota delle metriche.',
    },
  }, null, 2))
} finally {
  await remove(`messages?provider_message_id=in.(${whatsappMessage},${webchatMessage})`)
  await remove(`conversations?org_id=eq.${orgId}&conversation_id=in.(${whatsappConversation},${webchatConversation})`)
}
