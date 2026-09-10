import * as XLSX from 'xlsx'
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
await admin.from('contacts').delete().eq('client_id', tenant.id).eq('email', 'giulia.excel@example.com')
const workbook = XLSX.utils.book_new()
const sheet = XLSX.utils.json_to_sheet([{ 'Nome Cliente': 'Giulia', 'Cognome Cliente': 'Excel', 'Email Cliente': 'giulia.excel@example.com', 'Cellulare Principale': '+393339991111', 'Stato Contatto': 'Da contattare', 'Note': 'Contatto importato da XLSX personalizzato' }])
XLSX.utils.book_append_sheet(workbook, sheet, 'Rubrica')
const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
const form = new FormData(); form.append('file', new Blob([xlsxBuffer]), 'rubrica-personalizzata.xlsx')
const importResponse = await fetch(`${baseUrl}/api/client/contacts/import`, { method: 'POST', headers: { Authorization: `Bearer ${auth.session.access_token}` }, body: form })
const importResult = await importResponse.json()
if (!importResponse.ok) throw new Error(JSON.stringify({ importStatus: importResponse.status, importResult }))
const { data: contact, error: contactError } = await admin.from('contacts').select('id, client_id, first_name, last_name, email, phone, stage').eq('client_id', tenant.id).eq('email', 'giulia.excel@example.com').single()
if (contactError || !contact) throw contactError || new Error('Contatto XLSX non trovato')
const callId = `xlsx-vapi-${Date.now()}`
const conversationId = `xlsx-vapi-conversation-${Date.now()}`
const payload = { org_id: tenant.id, message: { type: 'end-of-call-report', call: { id: callId, conversationId, customer: { number: contact.phone }, durationSeconds: 74, startedAt: new Date(Date.now() - 74000).toISOString(), endedAt: new Date().toISOString(), direction: 'inbound' }, phoneNumber: { number: '+390212345678' }, artifact: { transcript: 'Il cliente Giulia Excel richiede assistenza.', recording: { url: 'https://example.com/demo-recording.mp3' } } } }
const vapiResponse = await fetch(`${baseUrl}/api/webhooks/ai/vapi`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': webhookSecret }, body: JSON.stringify(payload) })
const vapiResult = await vapiResponse.json().catch(() => ({}))
if (!vapiResponse.ok) throw new Error(JSON.stringify({ vapiStatus: vapiResponse.status, vapiResult }))
const { data: call } = await admin.from('calls').select('id, contact_id, provider_call_id, org_id').eq('provider_call_id', callId).single()
const { data: conversation } = await admin.from('conversations').select('id, contact_id, conversation_id, channel').eq('conversation_id', conversationId).single()
const verified = call?.contact_id === contact.id && conversation?.contact_id === contact.id
await admin.from('calls').delete().eq('provider_call_id', callId)
await admin.from('conversations').delete().eq('conversation_id', conversationId).eq('org_id', tenant.id)
await admin.from('contacts').delete().eq('id', contact.id)
await anon.auth.signOut()
if (!verified) throw new Error(JSON.stringify({ verified: false, call, conversation }))
console.log(JSON.stringify({ ok: true, importStatus: importResponse.status, imported: importResult.imported, mappedFields: ['first_name', 'last_name', 'email', 'phone', 'stage', 'notes'], vapiStatus: vapiResponse.status, contactId: contact.id, callContactId: call.contact_id, conversationContactId: conversation.contact_id, cleanedUp: true }, null, 2))
