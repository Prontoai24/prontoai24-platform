#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) throw new Error('Supabase env mancanti')
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const email = `admin-reset-e2e-${Date.now()}@example.invalid`
const temporaryPassword = `Tmp-${crypto.randomBytes(8).toString('hex')}!A1`
const newPassword = `New-${crypto.randomBytes(8).toString('hex')}!A1`
let userId
try {
  const created = await admin.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true, user_metadata: { role: 'admin', must_change_password: true, force_password_change: true } })
  if (created.error) throw created.error
  userId = created.data.user.id
  const profile = await admin.from('profiles').upsert({ id: userId, role: 'admin', email, full_name: 'Admin Reset E2E', must_change_password: true }, { onConflict: 'id' })
  if (profile.error) throw profile.error

  const firstLogin = await auth.auth.signInWithPassword({ email, password: temporaryPassword })
  if (firstLogin.error) throw firstLogin.error
  const updatePassword = await auth.auth.updateUser({ password: newPassword })
  if (updatePassword.error) throw updatePassword.error
  const metadata = await admin.auth.admin.updateUserById(userId, { user_metadata: { role: 'admin', must_change_password: false, force_password_change: false } })
  if (metadata.error) throw metadata.error
  const completed = await admin.from('profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', userId)
  if (completed.error) throw completed.error
  await auth.auth.signOut({ scope: 'global' })

  const secondLogin = await auth.auth.signInWithPassword({ email, password: newPassword })
  if (secondLogin.error) throw secondLogin.error
  const checkedProfile = await admin.from('profiles').select('role, must_change_password').eq('id', userId).single()
  if (checkedProfile.error || checkedProfile.data?.must_change_password !== false || checkedProfile.data?.role !== 'admin') throw new Error(`Profilo non completato: ${JSON.stringify(checkedProfile.data)}`)
  const checkedAuth = await admin.auth.admin.getUserById(userId)
  const metadataOk = checkedAuth.data.user?.user_metadata?.must_change_password === false && checkedAuth.data.user?.user_metadata?.force_password_change === false
  if (!metadataOk) throw new Error(`Metadati Auth non sincronizzati: ${JSON.stringify(checkedAuth.data.user?.user_metadata)}`)
  console.log(JSON.stringify({ ok: true, email, profile: checkedProfile.data, authMetadata: { must_change_password: false, force_password_change: false }, secondLogin: true, adminDashboardEligible: true }, null, 2))
} finally {
  await auth.auth.signOut({ scope: 'global' }).catch(() => {})
  if (userId) await admin.auth.admin.deleteUser(userId)
}
