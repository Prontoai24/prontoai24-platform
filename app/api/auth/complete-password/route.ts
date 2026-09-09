import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
type CookieMutation = { name: string; value: string; options: CookieOptions }

function jsonError(error: string, status: number) {
  return NextResponse.json({ error, profileCompleted: false }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const mutations: CookieMutation[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieHeader.split('; ').find((value) => value.startsWith(`${name}=`))?.split('=').slice(1).join('=') },
        set(name: string, value: string, options: CookieOptions) { mutations.push({ name, value, options }) },
        remove(name: string, options: CookieOptions) { mutations.push({ name, value: '', options: { ...options, maxAge: 0 } }) },
      },
    }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return jsonError('Sessione non valida o scaduta. Effettua nuovamente il login.', 401)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonError('Configurazione server incompleta: SUPABASE_SERVICE_ROLE_KEY mancante.', 503)

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return jsonError('La nuova password non rispetta i requisiti di sicurezza.', 400)

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

    await supabase.auth.signOut({ scope: 'global' })
    mutations.push({ name: 'sb-session-reset', value: '1', options: { path: '/', maxAge: 10, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } })
    const response = NextResponse.json({ success: true, profileCompleted: true, userId: user.id, mustChangePassword: false, signedOut: true }, { headers: { 'Cache-Control': 'no-store' } })
    for (const mutation of mutations) response.cookies.set({ name: mutation.name, value: mutation.value, ...mutation.options })
    return response
  } catch (error) {
    return jsonError(error instanceof Error ? `Errore server nel completamento profilo: ${error.message}` : 'Errore server nel completamento profilo.', 500)
  }
}
