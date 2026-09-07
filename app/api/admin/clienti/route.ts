import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let password = ''
  while (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    const bytes = crypto.randomBytes(16)
    password = Array.from({ length: bytes.length }, (_, index) => alphabet[bytes[index] % alphabet.length]).join('')
  }
  return password
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const body = await request.json()
  const { companyName, vatNumber, fiscalCode, contactEmail, contactPhone, billingAddress, status = 'in_setup', managedByAdmin = user.id, planId, planType, includedMinutes, billingCycle, monthlyPrice, sendInvite = true } = body
  if (!contactEmail || !companyName) return NextResponse.json({ error: 'companyName e contactEmail sono obbligatori' }, { status: 400 })
  if (profile.role === 'admin' && managedByAdmin !== user.id) return NextResponse.json({ error: 'Un admin può assegnare solo a se stesso' }, { status: 403 })

  const adminClient = createAdminClient()
  let profileId: string | null = null
  let password: string | null = null
  if (sendInvite) {
    password = temporaryPassword()
    const { data: authUser, error } = await adminClient.auth.admin.createUser({ email: contactEmail, password, email_confirm: true, user_metadata: { role: 'client', must_change_password: true } })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    profileId = authUser.user.id
    const { error: profileError } = await adminClient.from('profiles').insert({ id: profileId, role: 'client', full_name: companyName, email: contactEmail, must_change_password: true, created_by: user.id })
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  const { data: client, error } = await adminClient.from('clients').insert({ profile_id: profileId, company_name: companyName, vat_number: vatNumber || null, fiscal_code: fiscalCode || null, contact_email: contactEmail, contact_phone: contactPhone || null, billing_address: billingAddress || null, status, managed_by_admin: managedByAdmin }).select('id, company_name, contact_email, status').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (planType && includedMinutes && billingCycle && monthlyPrice !== undefined) {
    const { error: subscriptionError } = await adminClient.from('subscriptions').insert({ client_id: client.id, tier: planType, minutes_package: Number(includedMinutes), commitment: billingCycle, monthly_price_cents: Math.round(Number(monthlyPrice) * 100), status: 'in_setup' })
    if (subscriptionError) return NextResponse.json({ error: subscriptionError.message }, { status: 400 })
  } else if (planId) {
    const { data: plan } = await adminClient.from('pricing_plans').select('tier, minutes_package, whatsapp_addon_price_cents, chatbot_addon_price_cents').eq('id', planId).single()
    if (plan) await adminClient.from('subscriptions').insert({ client_id: client.id, tier: plan.tier, minutes_package: plan.minutes_package, commitment: 'annuale', whatsapp_addon: plan.whatsapp_addon_price_cents > 0, chatbot_addon: plan.chatbot_addon_price_cents > 0, status: 'in_setup' })
  }

  if (password) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'Cliente creato, ma RESEND_API_KEY non configurata' }, { status: 503 })
    const resend = new Resend(resendKey)
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://client.prontoai24.it'
    const { error: emailError } = await resend.emails.send({ from: 'ProntoAI24 <no-reply@prontoai24.it>', to: contactEmail, subject: 'Benvenuto nell’Area Clienti ProntoAI24', text: `Il tuo accesso è pronto. Area Clienti: ${loginUrl}\nEmail: ${contactEmail}\nPassword temporanea: ${password}\nAl primo accesso dovrai impostare una nuova password.`, html: `<p>Il tuo accesso all’Area Clienti è pronto.</p><p><strong>Area Clienti:</strong> <a href="${loginUrl}">${loginUrl}</a><br><strong>Email:</strong> ${contactEmail}<br><strong>Password temporanea:</strong> ${password}</p><p>Al primo accesso dovrai impostare una nuova password.</p>` })
    if (emailError) return NextResponse.json({ error: `Cliente creato, ma invio email fallito: ${emailError.message}` }, { status: 502 })
  }

  await adminClient.from('audit_logs').insert({ actor_id: user.id, action: 'client.created', entity_type: 'client', entity_id: client.id, metadata: { contactEmail, planId, inviteSent: Boolean(password) } })
  return NextResponse.json({ success: true, client, inviteSent: Boolean(password) }, { status: 201 })
}
