import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const email = 'it-admin@prontoai24.it'
const adminUrl = 'https://admin.prontoai24.it'
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']
const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  throw new Error(`Variabili mancanti: ${missing.join(', ')}`)
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let password = ''
  while (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%]/.test(password)) {
    password = [...crypto.randomBytes(16)].map((byte) => alphabet[byte % alphabet.length]).join('')
  }
  return password
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const resend = new Resend(process.env.RESEND_API_KEY)
const passwordTemporanea = generateTemporaryPassword()

const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError

let user = users.users.find((candidate) => candidate.email?.toLowerCase() === email)
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: passwordTemporanea,
    email_confirm: true,
    user_metadata: { role: 'super_admin', must_change_password: true },
  })
  if (error) throw error
  user = data.user
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: passwordTemporanea,
    user_metadata: { ...(user.user_metadata ?? {}), role: 'super_admin', must_change_password: true },
  })
  if (error) throw error
  user = data.user
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: user.id,
  role: 'super_admin',
  full_name: 'ProntoAI24 Super Admin',
  email,
  must_change_password: true,
}, { onConflict: 'id' })
if (profileError) throw profileError

const { data: emailData, error: emailError } = await resend.emails.send({
  from: 'ProntoAI24 <no-reply@prontoai24.it>',
  to: email,
  subject: 'Benvenuto nell’Area Admin di ProntoAI24',
  text: `Il tuo accesso Super Admin è pronto.\n\nArea Admin: ${adminUrl}\nEmail: ${email}\nPassword temporanea: ${passwordTemporanea}\n\nAl primo accesso dovrai impostare una nuova password.`,
  html: `<p>Il tuo accesso <strong>Super Admin</strong> è pronto.</p><p><strong>Area Admin:</strong> <a href="${adminUrl}">${adminUrl}</a><br><strong>Email:</strong> ${email}<br><strong>Password temporanea:</strong> ${passwordTemporanea}</p><p>Al primo accesso dovrai impostare una nuova password.</p>`,
})
if (emailError) throw emailError

console.log(JSON.stringify({ email, userId: user.id, emailId: emailData?.id, mustChangePassword: true }, null, 2))
