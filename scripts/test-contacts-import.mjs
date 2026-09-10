import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD
if (!password) throw new Error('Imposta DEMO_CLIENT_PASSWORD per il test')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error || !data.session) throw error || new Error('Login demo fallito')
const csv = 'Nome,Cognome,Email,Telefono,Messenger,Instagram,Note,Stato\nLuca,Demo,luca.demo@example.com,+393339876543,,,Import CSV,Nuovo\n'
fs.writeFileSync('/tmp/prontoai24-contacts-fixture.csv', csv)
const form = new FormData()
form.append('file', new Blob([csv], { type: 'text/csv' }), 'contacts-fixture.csv')
const response = await fetch(`${baseUrl}/api/client/contacts/import`, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` }, body: form })
const result = await response.json()
if (!response.ok) throw new Error(JSON.stringify({ status: response.status, result }))
const listResponse = await fetch(`${baseUrl}/api/client/contacts?search=luca.demo%40example.com`, { headers: { Authorization: `Bearer ${data.session.access_token}` } })
const list = await listResponse.json()
console.log(JSON.stringify({ importStatus: response.status, imported: result.imported, lookupStatus: listResponse.status, found: list.contacts?.some((contact) => contact.email === 'luca.demo@example.com'), fixture: '/tmp/prontoai24-contacts-fixture.csv' }, null, 2))
await supabase.auth.signOut()
