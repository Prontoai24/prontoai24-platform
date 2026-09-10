import { createClient } from '@supabase/supabase-js'
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD
const webhookSecret = process.env.TEST_WEBHOOK_SECRET || 'local-vapi-test-secret'
if (!password) throw new Error('Imposta DEMO_CLIENT_PASSWORD')
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: auth, error: authError } = await anon.auth.signInWithPassword({ email, password })
if (authError || !auth.session) throw authError || new Error('Login demo fallito')
const { data: tenant, error: tenantError } = await anon.from('clients').select('id').eq('profile_id', auth.user.id).single()
if (tenantError || !tenant) throw tenantError || new Error('Tenant demo non trovato')
const { data: contact, error: contactError } = await admin.from('contacts').select('id,client_id,first_name,last_name,phone,email').eq('client_id', tenant.id).eq('email', 'luca.demo@example.com').single()
if (contactError || !contact) throw contactError || new Error('Contatto Luca non trovato')
const providerCallId = `inbound-e2e-${Date.now()}`
const conversationId = `inbound-e2e-conversation-${Date.now()}`
const payload = { org_id: tenant.id, message: { type: 'end-of-call-report', call: { id: providerCallId, conversationId, customer: { number: contact.phone }, durationSeconds: 91, startedAt: new Date(Date.now() - 91000).toISOString(), endedAt: new Date().toISOString(), direction: 'inbound', endedReason: 'customer-ended-call' }, phoneNumber: { number: '+390212345678' }, artifact: { transcript: `Cliente ${contact.first_name} ${contact.last_name || ''}: vorrei informazioni sul mio appuntamento.`, recording: { url: 'https://example.com/inbound-e2e-recording.mp3' } } } }
const response = await fetch(`${baseUrl}/api/webhooks/ai/vapi`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': webhookSecret }, body: JSON.stringify(payload) })
const result = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(JSON.stringify({ status: response.status, result }))
const { data: call, error: callError } = await admin.from('calls').select('id,org_id,contact_id,provider_call_id,conversation_id,duration,status,from_number').eq('provider_call_id', providerCallId).single()
const { data: conversation, error: conversationError } = await admin.from('conversations').select('id,org_id,contact_id,conversation_id,channel,transcript').eq('conversation_id', conversationId).single()
if (callError || conversationError) throw callError || conversationError
const synchronized = call.contact_id === contact.id && conversation.contact_id === contact.id && call.org_id === tenant.id && conversation.org_id === tenant.id
await admin.from('calls').delete().eq('provider_call_id', providerCallId)
await admin.from('conversations').delete().eq('conversation_id', conversationId).eq('org_id', tenant.id)
await anon.auth.signOut()
if (!synchronized) throw new Error(JSON.stringify({ synchronized: false, call, conversation, contact }))
console.log(JSON.stringify({ ok: true, webhookStatus: response.status, event: result.event, tenantId: tenant.id, contact: { id: contact.id, name: `${contact.first_name} ${contact.last_name || ''}`.trim(), phone: contact.phone }, call: { id: call.id, duration: call.duration, direction: call.from_number ? 'inbound' : null, contact_id: call.contact_id }, conversation: { id: conversation.id, channel: conversation.channel, contact_id: conversation.contact_id, transcriptSaved: Boolean(conversation.transcript) }, synchronized: true, cleanedUp: true }, null, 2))
