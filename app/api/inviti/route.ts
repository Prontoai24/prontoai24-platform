import crypto from 'node:crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

// Genera una password temporanea leggibile ma sicura
function generaPasswordTemporanea() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = crypto.randomBytes(16)
  return Array.from({ length: bytes.length }, (_, index) => chars[bytes[index] % chars.length]).join('')
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: chiamante } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { email, role, fullName } = await request.json()

  // Solo il super_admin crea admin; admin e super_admin creano client
  if (role === 'admin' && chiamante?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo il super-admin può creare admin' }, { status: 403 })
  }
  if (!['admin', 'client'].includes(role)) {
    return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'Servizio email non configurato' }, { status: 503 })
  }
  const passwordTemporanea = generaPasswordTemporanea()

  // Crea l'utente Auth direttamente con la password temporanea
  const { data: nuovoUtente, error: erroreCreazione } = await adminClient.auth.admin.createUser({
    email,
    password: passwordTemporanea,
    email_confirm: true,
    user_metadata: { must_change_password: true, force_password_change: true, role, full_name: fullName || null },
  })

  if (erroreCreazione) {
    return NextResponse.json({ error: erroreCreazione.message }, { status: 400 })
  }

  // Crea il profilo collegato, con obbligo di cambio password al primo accesso
  await adminClient.from('profiles').insert({
    id: nuovoUtente.user.id,
    role,
    full_name: fullName,
    email,
    must_change_password: true,
    created_by: user.id,
  })

  // Invia l'email con le credenziali; l'SDK viene inizializzato solo quando la route viene chiamata.
  const resend = new Resend(resendKey)
  await resend.emails.send({
    from: 'ProntoAI24 <no-reply@prontoai24.it>',
    to: email,
    subject: 'Le tue credenziali di accesso a ProntoAI24',
    html: `
      <p>Ciao ${fullName || ''},</p>
      <p>Il tuo account ${role === 'admin' ? 'Admin' : 'Cliente'} su ProntoAI24 è stato creato.</p>
      <p><strong>Email:</strong> ${email}<br/>
      <strong>Password temporanea:</strong> ${passwordTemporanea}</p>
      <p>Al primo accesso ti verrà chiesto di impostare una nuova password.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://prontoai24.it'}/login">Accedi a ProntoAI24</a></p>
    `,
  })

  return NextResponse.json({ success: true, userId: nuovoUtente.user.id })
}
