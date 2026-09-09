import { createAdminClient } from '@/lib/supabase/server'

export async function getAllOrganizations() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('clients').select('id, company_name, status, contact_email, managed_by_admin, created_at, profile_id, subscriptions(tier, status)').order('created_at', { ascending: false })
  if (error) throw new Error(`Errore caricamento organizzazioni: ${error.message}`)
  return data || []
}

export async function generateImpersonationLink(clientId: string) {
  const admin = createAdminClient()
  const { data: client, error: clientError } = await admin.from('clients').select('id, profile_id, company_name').eq('id', clientId).single()
  if (clientError || !client?.profile_id) throw new Error('Nessun utente cliente trovato per l’organizzazione selezionata.')
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(client.profile_id)
  if (authError || !authUser.user?.email) throw new Error('Impossibile recuperare l’email dell’utente target.')
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_APP_URL || 'https://client.prontoai24.it'
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: authUser.user.email, options: { redirectTo: `${clientUrl}/auth/callback?impersonated=true` } })
  if (linkError || !linkData.properties.action_link) throw new Error(`Errore generazione link: ${linkError?.message || 'link non disponibile'}`)
  return linkData.properties.action_link
}
