import { createClient } from '@supabase/supabase-js'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD
if (!password) throw new Error('Imposta DEMO_CLIENT_PASSWORD')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError || !auth.user || !auth.session) throw authError || new Error('Login demo fallito')
const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,role,status,must_change_password').eq('id', auth.user.id).single()
if (profileError) throw profileError
const { data: client, error: clientError } = await supabase.from('clients').select('id,profile_id,company_name,contact_email,status').eq('profile_id', auth.user.id).single()
if (clientError) throw clientError
const { count: conversations } = await supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('org_id', client.id)
const { count: contacts } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', client.id)
console.log(JSON.stringify({ ok: true, login: true, userId: auth.user.id, email: auth.user.email, profile, client, dashboardScopes: { conversations: conversations || 0, contacts: contacts || 0, voiceReady: true } }, null, 2))
await supabase.auth.signOut()
