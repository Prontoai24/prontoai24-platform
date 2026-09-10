import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRole) throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatorie')

const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD || `${crypto.randomBytes(9).toString('base64url')}A1!`
const companyName = process.env.DEMO_CLIENT_COMPANY || 'Cliente Demo - Studio Medico Aurora'
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const found = existing.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
const authResult = found
  ? await admin.auth.admin.updateUserById(found.id, { password, user_metadata: { role: 'client', must_change_password: true, demo_account: true } })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'client', must_change_password: true, demo_account: true } })
if (authResult.error || !authResult.data.user) throw authResult.error || new Error('Creazione utente fallita')
const user = authResult.data.user

const { error: profileError } = await admin.from('profiles').upsert({ id: user.id, role: 'client', full_name: companyName, must_change_password: true, status: 'active' }, { onConflict: 'id' })
if (profileError) throw profileError

let { data: manager } = await admin.from('profiles').select('id').eq('role', 'super_admin').limit(1).maybeSingle()
if (!manager) ({ data: manager } = await admin.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle())
if (!manager) throw new Error('Nessun profilo admin/super_admin disponibile per managed_by_admin')

const { data: client, error: clientError } = await admin.from('clients').upsert({ profile_id: user.id, company_name: companyName, managed_by_admin: manager.id, status: 'active' }, { onConflict: 'profile_id' }).select('id').single()
if (clientError || !client) throw clientError || new Error('Creazione tenant demo fallita')

const examples = [
  { key: 'demo-voice-001', channel: 'voice', transcript: 'Cliente: Vorrei spostare la visita di domani. Assistente: Verifico le disponibilità e la ricontatto.' },
  { key: 'demo-whatsapp-001', channel: 'whatsapp', transcript: 'Cliente: Buongiorno, avete ricevuto la mia richiesta? Assistente: Sì, la richiesta è stata presa in carico.' },
  { key: 'demo-webchat-001', channel: 'webchat', transcript: 'Cliente: Come posso richiedere una copia della fattura? Assistente: Può utilizzare il portale clienti oppure rispondere a questa chat.' },
]
for (const example of examples) {
  const { data: conversation, error } = await admin.from('conversations').upsert({ org_id: client.id, conversation_id: example.key, channel: example.channel, transcript: example.transcript }, { onConflict: 'org_id,conversation_id' }).select('id').single()
  if (error || !conversation) throw error || new Error(`Conversazione ${example.key} non creata`)
  if (example.channel !== 'voice') await admin.from('messages').upsert({ org_id: client.id, conversation_id: conversation.id, provider: example.channel === 'whatsapp' ? 'whatsapp' : 'webchat', provider_message_id: `${example.key}-message`, direction: 'inbound', body: example.transcript, occurred_at: new Date().toISOString() }, { onConflict: 'provider,provider_message_id' })
}

console.log(JSON.stringify({ ok: true, email, temporaryPassword: password, userId: user.id, clientId: client.id, companyName, warning: 'Account demo creato senza acquistare numeri o inviare chiamate/SMS reali.' }, null, 2))
