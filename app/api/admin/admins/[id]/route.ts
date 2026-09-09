import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient, createClient } from '@/lib/supabase/server'

type RouteContext = { params: { id: string } }

async function requireSuperAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: NextResponse.json({ error: 'Solo il Super Admin può gestire gli account admin.' }, { status: 403 }) }
  return { user }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  if (!params.id || params.id === auth.user.id) return NextResponse.json({ error: 'Non puoi modificare il tuo account da questa schermata.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, string> = {}
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim()
  if (body.role === 'admin' || body.role === 'client') updates.role = body.role
  if (body.status === 'active' || body.status === 'suspended') updates.status = body.status
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  if (requestedEmail) {
    if (!/^\S+@\S+\.\S+$/.test(requestedEmail)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 })
    updates.email = requestedEmail
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nessuna modifica ricevuta.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('profiles').select('id, role, email, full_name, status').eq('id', params.id).single()
  if (targetError || !target) return NextResponse.json({ error: 'Account non trovato.' }, { status: 404 })
  if (target.role === 'super_admin') return NextResponse.json({ error: 'Gli account Super Admin non sono modificabili da questa schermata.' }, { status: 403 })

  if (requestedEmail && requestedEmail !== target.email) {
    const { error } = await admin.auth.admin.updateUserById(params.id, { email: requestedEmail, email_confirm: false })
    if (error) return NextResponse.json({ error: `Email Auth non aggiornata: ${error.message}` }, { status: 400 })
  }
  const { data: profile, error } = await admin.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', params.id).select('id, full_name, email, role, status, must_change_password').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (requestedEmail && requestedEmail !== target.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'ProntoAI24 <no-reply@prontoai24.it>',
      to: requestedEmail,
      subject: 'Aggiornamento accesso ProntoAI24',
      html: `<p>Ciao ${profile.full_name || ''},</p><p>Il tuo indirizzo di accesso è stato aggiornato. Usa questa email per accedere all’Area Admin e completa il cambio password se richiesto.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://prontoai24.it'}/login">Accedi a ProntoAI24</a></p>`,
    })
  }
  return NextResponse.json({ success: true, profile })
}
