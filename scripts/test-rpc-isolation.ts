import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const env = (key: string) => { const value = process.env[key]; if (!value) throw new Error(`${key} mancante`); return value }
const url = env('NEXT_PUBLIC_SUPABASE_URL')
const service = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const id = crypto.randomUUID(); const email = `qa-rpc-${id}@example.com`; const password = `Qa!${id}a1`
let userId: string | undefined; let clientId: string | undefined
async function main() {
try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); if (created.error || !created.data.user) throw new Error(`user fixture: ${created.error?.message || 'utente non creato'}`)
  userId = created.data.user.id
  const profile = await service.from('profiles').insert({ id: userId, role: 'client', email, full_name: 'RPC QA', must_change_password: false }); if (profile.error) throw profile.error
  const tenant = await service.from('clients').insert({ profile_id: userId, managed_by_admin: userId, contact_email: email, company_name: 'RPC QA', status: 'active' }).select('id').single(); if (tenant.error || !tenant.data) throw tenant.error || new Error('tenant fixture'); clientId = tenant.data.id
  const vector = `[${Array.from({ length: 1536 }, () => '0').join(',')}]`
  const serviceRpc = await service.rpc('match_knowledge_chunks', { query_embedding: vector, match_org_id: clientId, match_threshold: 0, match_count: 1 })
  const user = createClient(url, anonKey, { auth: { persistSession: false } }); const login = await user.auth.signInWithPassword({ email, password }); if (login.error) throw login.error
  const foreignRpc = await user.rpc('match_knowledge_chunks', { query_embedding: vector, match_org_id: crypto.randomUUID(), match_threshold: 0, match_count: 1 })
  console.log(JSON.stringify({ serviceRole: { allowed: !serviceRpc.error, code: serviceRpc.error?.code || null }, authenticatedForeignOrg: { denied: Boolean(foreignRpc.error), code: foreignRpc.error?.code || null, message: foreignRpc.error?.message || null }, expectedCode: '42501' }, null, 2))
} finally { if (clientId) await service.from('clients').delete().eq('id', clientId); if (userId) { await service.from('profiles').delete().eq('id', userId); await service.auth.admin.deleteUser(userId) } }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
