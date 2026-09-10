import { createClient } from '@supabase/supabase-js'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD
if (!password) throw new Error('Imposta DEMO_CLIENT_PASSWORD')
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: auth, error: authError } = await anon.auth.signInWithPassword({ email, password })
if (authError || !auth.user) throw authError || new Error('Login demo fallito')
const { data: client, error: clientError } = await anon.from('clients').select('id').eq('profile_id', auth.user.id).single()
if (clientError || !client) throw clientError || new Error('Tenant demo non trovato')
const results = { contacts: false, calls: false, conversations: false, clientId: client.id }
const channel = anon.channel(`realtime-test-${client.id}`)
let subscriptionStatus = 'UNKNOWN'
const eventPromise = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timeout Realtime: ${JSON.stringify({ results, subscriptionStatus })}`)), 12000)
  const check = () => { if (results.contacts && results.calls && results.conversations) { clearTimeout(timer); resolve() } }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `client_id=eq.${client.id}` }, () => { results.contacts = true; check() })
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `org_id=eq.${client.id}` }, () => { results.calls = true; check() })
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `org_id=eq.${client.id}` }, () => { results.conversations = true; check() })
})
await new Promise((resolve, reject) => channel.subscribe((status) => { subscriptionStatus = status; status === 'SUBSCRIBED' ? resolve() : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? reject(new Error(`Realtime channel ${status}`)) : null }))
const contactInsert = await admin.from('contacts').insert({ client_id: client.id, first_name: 'Realtime', last_name: 'Test', email: `realtime-${Date.now()}@example.com`, phone: '+393330000111', stage: 'Nuovo' }).select('id').single()
if (contactInsert.error) throw contactInsert.error
const contact = contactInsert.data
const callInsert = await admin.from('calls').insert({ org_id: client.id, provider_call_id: `realtime-${Date.now()}`, conversation_id: `realtime-${Date.now()}`, from_number: '+393330000111', status: 'test' }).select('id').single()
if (callInsert.error) throw callInsert.error
const call = callInsert.data
const conversationInsert = await admin.from('conversations').insert({ org_id: client.id, conversation_id: `realtime-${Date.now()}`, channel: 'voice', contact_id: contact?.id || null, transcript: 'Realtime test' }).select('id').single()
if (conversationInsert.error) throw conversationInsert.error
const conversation = conversationInsert.data
try { await eventPromise } finally { if (contact?.id) await admin.from('contacts').delete().eq('id', contact.id); if (call?.id) await admin.from('calls').delete().eq('id', call.id); if (conversation?.id) await admin.from('conversations').delete().eq('id', conversation.id); await anon.removeChannel(channel); await anon.auth.signOut() }
console.log(JSON.stringify({ ok: true, ...results }, null, 2))
