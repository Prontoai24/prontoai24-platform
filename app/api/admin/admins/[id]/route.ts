import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient, createClient } from '@/lib/supabase/server'

type RouteContext = { params: { id: string } }

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = crypto.randomBytes(12)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

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
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  if (requestedEmail && !/^\S+@\S+\.\S+$/.test(requestedEmail)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('profiles').select('id, role, email, full_name, status, must_change_password').eq('id', params.id).single()
  if (targetError || !target) return NextResponse.json({ error: 'Account non trovato.' }, { status: 404 })
  if (target.role === 'super_admin') return NextResponse.json({ error: 'Gli account Super Admin non sono modificabili da questa schermata.' }, { status: 403 })

  const emailChanged = Boolean(requestedEmail && requestedEmail !== target.email)
  const updates: Record<string, string | boolean> = {}
  if (typeof body.fullName === 'string') updates.full_name = body.fullName.trim()
  if (body.role === 'admin' || body.role === 'client') updates.role = body.role
  if (body.status === 'active' || body.status === 'suspended') updates.status = body.status
  if (requestedEmail) updates.email = requestedEmail
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nessuna modifica ricevuta.' }, { status: 400 })

  let temporaryPassword: string | null = null
  if (emailChanged) {
    temporaryPassword = generateTemporaryPassword()
    const { error } = await admin.auth.admin.updateUserById(params.id, {
      email: requestedEmail,
      email_confirm: true,
      password: temporaryPassword,
      user_metadata: { must_change_password: true, force_password_change: true, role: body.role === 'client' ? 'client' : 'admin' },
    })
    if (error) return NextResponse.json({ error: `Credenziali Auth non aggiornate: ${error.message}` }, { status: 400 })
    updates.must_change_password = true
  }

  const { data: profile, error } = await admin.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', params.id).select('id, full_name, email, role, status, must_change_password').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (emailChanged) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'Credenziali aggiornate, ma RESEND_API_KEY non è configurata: impossibile inviare la password temporanea.' }, { status: 503 })
    const resend = new Resend(resendKey)
    const { error: emailError } = await resend.emails.send({
      from: 'ProntoAI24 <no-reply@prontoai24.it>',
      to: requestedEmail!,
      subject: 'Nuove credenziali di accesso ProntoAI24',
      html: `<p>Ciao ${profile.full_name || ''},</p><p>Il tuo indirizzo di accesso ProntoAI24 è stato aggiornato.</p><p><strong>Email:</strong> ${requestedEmail}<br/><strong>Password temporanea:</strong> ${temporaryPassword}</p><p>Al primo accesso dovrai impostare una nuova password.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://prontoai24.it'}/login">Effettua il primo accesso</a></p>`,
    })
    if (emailError) return NextResponse.json({ error: `Credenziali aggiornate, ma invio Resend non riuscito: ${emailError.message}` }, { status: 502 })
  }

  return NextResponse.json({ success: true, profile, credentialsReset: emailChanged, notificationSent: emailChanged })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  if (!params.id || params.id === auth.user.id) return NextResponse.json({ error: 'Non puoi eliminare il tuo account Super Admin.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('profiles').select('id, role').eq('id', params.id).single()
  if (targetError || !target) return NextResponse.json({ error: 'Account non trovato.' }, { status: 404 })
  if (target.role === 'super_admin') return NextResponse.json({ error: 'Un account Super Admin non può essere eliminato da questa schermata.' }, { status: 403 })
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: `Eliminazione Auth non riuscita: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true, deletedId: params.id })
}
