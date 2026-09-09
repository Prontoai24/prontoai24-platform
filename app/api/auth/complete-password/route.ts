import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function jsonError(error: string, status: number) {
  return NextResponse.json({ error, profileCompleted: false }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return jsonError('Sessione non valida o scaduta. Effettua nuovamente il login.', 401)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonError('Configurazione server incompleta: SUPABASE_SERVICE_ROLE_KEY mancante.', 503)

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return jsonError('La nuova password non rispetta i requisiti di sicurezza.', 400)
  }

  try {
    const adminClient = createAdminClient()
    const { data: existingProfile } = await adminClient.from('profiles').select('role, full_name, email, created_by, status').eq('id', user.id).maybeSingle()
    const metadataRole = user.user_metadata?.role
    const role = existingProfile?.role || (metadataRole === 'client' || metadataRole === 'super_admin' ? metadataRole : 'admin')
    const email = existingProfile?.email || user.email || `${user.id}@invalid.local`
    const fullName = existingProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null
    const metadata = { ...(user.user_metadata || {}), must_change_password: false, force_password_change: false }

    const { data: updatedAuth, error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, { password, user_metadata: metadata })
    if (authUpdateError) return jsonError(`Supabase Auth non ha aggiornato password e metadati: ${authUpdateError.message}`, 500)
    if (!updatedAuth.user) return jsonError('Supabase Auth non ha restituito l’utente aggiornato.', 500)

    const { data: profile, error: profileError } = await adminClient.from('profiles').upsert({ id: user.id, role, full_name: fullName, email, status: existingProfile?.status || 'active', must_change_password: false, created_by: existingProfile?.created_by || null, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select('id, role, email, must_change_password').single()
    if (profileError) return jsonError(`Password aggiornata, ma il profilo non è stato completato: ${profileError.message}`, 500)
    if (!profile || profile.must_change_password !== false) return jsonError('Il profilo non è stato completato correttamente.', 500)

    // Invalida i cookie Supabase HTTP-only nella risposta server-side.
    await supabase.auth.signOut({ scope: 'global' })
    return NextResponse.json({ success: true, profileCompleted: true, userId: user.id, mustChangePassword: false, signedOut: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return jsonError(error instanceof Error ? `Errore server nel completamento profilo: ${error.message}` : 'Errore server nel completamento profilo.', 500)
  }
}
