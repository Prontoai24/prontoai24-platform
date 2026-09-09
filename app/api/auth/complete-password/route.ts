import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
type CookieMutation = { name: string; value: string; options: CookieOptions }
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/

function jsonError(error: string, status: number) {
  console.error('[complete-password] error', { status, error })
  return NextResponse.json({ error, profileCompleted: false }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function readRequestCookies(request: Request) {
  return (request.headers.get('cookie') || '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=')
    return { name: part.slice(0, separator).trim(), value: decodeURIComponent(part.slice(separator + 1).trim()) }
  })
}

export async function POST(request: Request) {
  const mutations: CookieMutation[] = []
  const requestCookies = readRequestCookies(request)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return requestCookies },
        setAll(cookies: CookieMutation[]) { mutations.push(...cookies) },
      },
    }
  )
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const tokenClient = bearer ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) : null
  const { data: { user }, error: authError } = tokenClient ? await tokenClient.auth.getUser(bearer) : await supabase.auth.getUser()
  if (authError || !user) return jsonError(`Sessione non valida o scaduta. Effettua nuovamente il login. (${authError?.message || 'utente non trovato'})`, 401)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonError('Configurazione server incompleta: SUPABASE_SERVICE_ROLE_KEY mancante.', 503)

  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !SPECIAL_CHARACTER_REGEX.test(password)) return jsonError('La nuova password non rispetta i requisiti di sicurezza.', 400)

  try {
    const adminClient = createAdminClient()
    const { data: existingProfile, error: profileReadError } = await adminClient.from('profiles').select('role, full_name, email, created_by').eq('id', user.id).maybeSingle()
    if (profileReadError) {
      console.error('[complete-password] profile read failed', { userId: user.id, code: profileReadError.code, message: profileReadError.message, details: profileReadError.details, hint: profileReadError.hint })
      return jsonError(`Impossibile leggere il profilo Admin: ${profileReadError.message}`, 500)
    }
    const metadataRole = user.user_metadata?.role
    const role = existingProfile?.role || (metadataRole === 'client' || metadataRole === 'super_admin' ? metadataRole : 'admin')
    const email = existingProfile?.email || user.email || `${user.id}@invalid.local`
    const fullName = existingProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null
    const metadata = { ...(user.user_metadata || {}), must_change_password: false, force_password_change: false }

    const { data: updatedAuth, error: authUpdateError } = await adminClient.auth.admin.updateUserById(user.id, { password, user_metadata: metadata })
    if (authUpdateError) {
      console.error('[complete-password] Auth update failed', { userId: user.id, code: authUpdateError.code, message: authUpdateError.message, status: authUpdateError.status })
      return jsonError(`Supabase Auth non ha aggiornato password e metadati: ${authUpdateError.message}`, 500)
    }
    if (!updatedAuth.user) return jsonError('Supabase Auth non ha restituito l’utente aggiornato.', 500)

    const profileValues = { role, full_name: fullName, email, status: 'active', must_change_password: false, created_by: existingProfile?.created_by || null, updated_at: new Date().toISOString() }
    const { data: updatedProfile, error: profileUpdateError } = await adminClient.from('profiles').update(profileValues).eq('id', user.id).select('id, role, email, status, must_change_password').maybeSingle()
    if (profileUpdateError) {
      console.error('[complete-password] profile update failed', { userId: user.id, code: profileUpdateError.code, message: profileUpdateError.message, details: profileUpdateError.details, hint: profileUpdateError.hint })
      return jsonError(`Password aggiornata, ma profiles non è stato aggiornato: ${profileUpdateError.message}`, 500)
    }
    let profile = updatedProfile
    if (!profile) {
      const fallback = await adminClient.from('profiles').upsert({ id: user.id, ...profileValues }, { onConflict: 'id' }).select('id, role, email, status, must_change_password').single()
      if (fallback.error) {
        console.error('[complete-password] profile upsert fallback failed', { userId: user.id, code: fallback.error.code, message: fallback.error.message, details: fallback.error.details, hint: fallback.error.hint })
        return jsonError(`Password aggiornata, ma profiles non è stato aggiornato: ${fallback.error.message}`, 500)
      }
      profile = fallback.data
    }
    if (!profile || profile.must_change_password !== false || profile.status !== 'active') {
      console.error('[complete-password] profile verification failed', { userId: user.id, profile })
      return jsonError('Password aggiornata, ma il profilo non è stato completato correttamente.', 500)
    }

    await supabase.auth.signOut({ scope: 'global' })
    mutations.push({ name: 'sb-session-reset', value: '1', options: { path: '/', maxAge: 10, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } })
    const response = NextResponse.json({ success: true, profileCompleted: true, userId: user.id, mustChangePassword: false, signedOut: true }, { headers: { 'Cache-Control': 'no-store' } })
    for (const mutation of mutations) response.cookies.set({ name: mutation.name, value: mutation.value, ...mutation.options })
    return response
  } catch (error) {
    console.error('Reset Password Error:', error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error)
    return jsonError(error instanceof Error ? `Errore server nel completamento profilo: ${error.message}` : 'Errore server nel completamento profilo.', 500)
  }
}
