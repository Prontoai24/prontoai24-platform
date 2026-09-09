'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/

export async function completeFirstAccess(newPassword: string) {
  if (typeof newPassword !== 'string' || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !SPECIAL_CHARACTER_REGEX.test(newPassword)) {
    return { success: false, error: 'La nuova password non rispetta i requisiti di sicurezza.' }
  }

  const sessionClient = createClient()
  const { data: { user }, error: sessionError } = await sessionClient.auth.getUser()
  if (sessionError || !user) return { success: false, error: 'Sessione di primo accesso non valida. Torna al login e riprova.' }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[completeFirstAccess] SUPABASE_SERVICE_ROLE_KEY mancante')
    return { success: false, error: 'Configurazione server incompleta.' }
  }

  const supabaseAdmin = createAdminClient()
  const { data: currentProfile, error: profileReadError } = await supabaseAdmin.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (profileReadError) {
    console.error('Errore Profile Admin: lettura', { userId: user.id, code: profileReadError.code, message: profileReadError.message })
    return { success: false, error: profileReadError.message }
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
    user_metadata: { ...(user.user_metadata || {}), must_change_password: false, force_password_change: false },
  })
  if (authError) {
    console.error('Errore Auth Admin:', { userId: user.id, code: authError.code, message: authError.message })
    return { success: false, error: authError.message }
  }

  const profileMutation = currentProfile
    ? await supabaseAdmin.from('profiles').update({ status: 'active', must_change_password: false, updated_at: new Date().toISOString() }).eq('id', user.id)
    : await supabaseAdmin.from('profiles').upsert({ id: user.id, role: user.user_metadata?.role === 'super_admin' ? 'super_admin' : 'admin', email: user.email || '', full_name: user.user_metadata?.full_name || user.user_metadata?.name || null, status: 'active', must_change_password: false, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (profileMutation.error) {
    console.error('Errore Profile Admin:', { userId: user.id, code: profileMutation.error.code, message: profileMutation.error.message, details: profileMutation.error.details })
    return { success: false, error: profileMutation.error.message }
  }

  await sessionClient.auth.signOut({ scope: 'global' }).catch((error) => console.error('[completeFirstAccess] logout failed', error))
  redirect('/login?updated=true')
}
