import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const email = process.env.DEMO_CLIENT_EMAIL || 'demo.cliente@prontoai24.it'
const password = process.env.DEMO_CLIENT_PASSWORD
if (!password) throw new Error('Imposta DEMO_CLIENT_PASSWORD')
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: auth, error: authError } = await anon.auth.signInWithPassword({ email, password })
if (authError || !auth.session) throw authError || new Error('Login demo fallito')
const { data: tenant, error: tenantError } = await anon.from('clients').select('id').eq('profile_id', auth.user.id).single()
if (tenantError || !tenant) throw tenantError || new Error('Tenant demo non trovato')
const fixture = fs.readFileSync('scripts/fixtures/contatti-complex-multipage.pdf')
const form = new FormData(); form.append('file', new Blob([fixture], { type: 'application/pdf' }), 'contatti-complex-multipage.pdf')
const importResponse = await fetch(`${baseUrl}/api/client/contacts/import`, { method: 'POST', headers: { Authorization: `Bearer ${auth.session.access_token}` }, body: form })
const importResult = await importResponse.json()
if (!importResponse.ok) throw new Error(JSON.stringify({ status: importResponse.status, importResult }))
const { data: imported, error: importedError } = await admin.from('contacts').select('id,first_name,last_name,email,phone,stage').eq('client_id', tenant.id).like('email', '%.pdf%@example.com')
if (importedError || !imported || imported.length !== 6) throw importedError || new Error(`Attesi 6 contatti PDF, ottenuti ${imported?.length || 0}`)
const target = imported[0]
const patchResponse = await fetch(`${baseUrl}/api/client/contacts`, { method: 'PATCH', headers: { Authorization: `Bearer ${auth.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: target.id, stage: 'In corso' }) })
const patchResult = await patchResponse.json()
if (!patchResponse.ok) throw new Error(JSON.stringify({ status: patchResponse.status, patchResult }))
const { data: moved, error: movedError } = await admin.from('contacts').select('id,stage').eq('id', target.id).single()
if (movedError || moved?.stage !== 'In corso') throw movedError || new Error(`Stato Kanban non aggiornato: ${moved?.stage}`)
await admin.from('contacts').delete().in('id', imported.map((row) => row.id))
await anon.auth.signOut()
console.log(JSON.stringify({ ok: true, pdfImportStatus: importResponse.status, imported: importResult.imported, pages: 2, extractedContacts: imported.length, kanbanPatchStatus: patchResponse.status, movedContactId: target.id, finalStage: moved.stage, cleanup: true }, null, 2))
