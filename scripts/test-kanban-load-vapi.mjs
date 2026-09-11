import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD || 'DemoContacts2026!A'
const webhookSecret = process.env.TEST_WEBHOOK_SECRET || 'local-vapi-test-secret'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError || !auth.session) throw new Error(`Login demo fallito: ${authError?.message || 'sessione assente'}`)
const token = auth.session.access_token
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const { data: profile } = await admin.from('profiles').select('id').eq('email', email).single()
const { data: client } = await admin.from('clients').select('id').eq('profile_id', profile.id).single()
if (!client) throw new Error('Tenant demo non trovato')

const fixture = Array.from({ length: 100 }, (_, index) => ({
  client_id: client.id,
  first_name: `Load${index + 1}`,
  last_name: 'Kanban',
  email: `load-${Date.now()}-${index}@example.test`,
  phone: `+3933900${String(index).padStart(5, '0')}`,
  stage: 'Nuovo',
}))
const { data: inserted, error: insertError } = await admin.from('contacts').insert(fixture).select('id')
if (insertError || !inserted?.length) throw new Error(`Seed contatti fallito: ${insertError?.message}`)
const ids = inserted.map((row) => row.id)
const postCallId = `demo-load-vapi-${Date.now()}`
try {
  const getStart = performance.now()
  const listResponse = await fetch(`${baseUrl}/api/client/contacts`, { headers })
  const listElapsedMs = Math.round(performance.now() - getStart)
  const listResult = await listResponse.json()
  if (!listResponse.ok) throw new Error(JSON.stringify(listResult))

  const patchStart = performance.now()
  const batches = []
  for (let offset = 0; offset < ids.length; offset += 10) {
    batches.push(Promise.all(ids.slice(offset, offset + 10).map((id) => fetch(`${baseUrl}/api/client/contacts`, { method: 'PATCH', headers, body: JSON.stringify({ id, stage: 'In corso' }) }).then(async (response) => ({ status: response.status, body: await response.json() })))))
  }
  const patchResults = []
  for (const batch of batches) patchResults.push(...await batch)
  const patchElapsedMs = Math.round(performance.now() - patchStart)
  const failedPatches = patchResults.filter((result) => result.status !== 200)
  if (failedPatches.length) throw new Error(`PATCH falliti: ${JSON.stringify(failedPatches.slice(0, 2))}`)

  const { count: movedCount } = await admin.from('contacts').select('id', { count: 'exact', head: true }).in('id', ids).eq('stage', 'In corso')
  const payload = {
    org_id: client.id,
    message: {
      type: 'end-of-call-report',
      call: {
        id: postCallId,
        conversationId: `demo-conversation-${postCallId}`,
        assistantId: 'demo-assistant-local',
        durationSeconds: 42,
        startedAt: new Date(Date.now() - 42_000).toISOString(),
        endedAt: new Date().toISOString(),
        customer: { number: '+393390000001' },
        endedReason: 'customer-ended-call',
      },
      artifact: {
        transcript: 'Cliente demo: richiesta di assistenza. Assistente: richiesta ricevuta.',
        recording: { url: 'https://example.test/demo-recording.wav' },
      },
    },
  }
  const webhookResponse = await fetch(`${baseUrl}/api/webhooks/vapi`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-prontoai-webhook-secret': webhookSecret }, body: JSON.stringify(payload) })
  const webhookResult = await webhookResponse.json()
  if (!webhookResponse.ok) throw new Error(`Webhook Vapi ${webhookResponse.status}: ${JSON.stringify(webhookResult)}`)
  const { data: savedCall } = await admin.from('calls').select('provider_call_id,status,duration,recording_url,conversation_id,org_id').eq('provider_call_id', postCallId).single()
  const { data: savedConversation } = await admin.from('conversations').select('conversation_id,channel,transcript,org_id').eq('conversation_id', `demo-conversation-${postCallId}`).single()
  if (!savedCall || !savedConversation) throw new Error('Record post-call Vapi non persistiti')
  console.log(JSON.stringify({ ok: true, tenantId: client.id, contacts: ids.length, listStatus: listResponse.status, listElapsedMs, patchCount: patchResults.length, patchElapsedMs, movedCount, webhookStatus: webhookResponse.status, webhookEvent: webhookResult.event, savedCall, savedConversation: { ...savedConversation, transcript: Boolean(savedConversation.transcript) }, cleanup: true }, null, 2))
} finally {
  await admin.from('calls').delete().eq('provider_call_id', postCallId || '')
  await admin.from('conversations').delete().eq('conversation_id', `demo-conversation-${postCallId || ''}`)
  await admin.from('contacts').delete().in('id', ids)
  await supabase.auth.signOut()
}
