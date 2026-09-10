'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encryptWhatsAppToken } from '@/lib/whatsapp'

export async function saveWhatsAppSettings(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sessione non valida' }
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) return { success: false, error: 'Tenant non trovato' }

  const phoneNumberId = String(formData.get('phoneNumberId') || '').trim()
  const wabaId = String(formData.get('wabaId') || '').trim()
  const token = String(formData.get('accessToken') || '').trim()
  const isActive = formData.get('isActive') === 'on'
  if (!phoneNumberId || !wabaId) return { success: false, error: 'Phone Number ID e WABA ID sono obbligatori' }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('tenant_channel_settings').select('whatsapp_access_token').eq('org_id', client.id).eq('provider', 'meta').maybeSingle()
  let encryptedToken = existing?.whatsapp_access_token || null
  if (token) encryptedToken = encryptWhatsAppToken(token)
  if (!encryptedToken) return { success: false, error: 'Inserisci il token di accesso Meta' }

  const { error } = await admin.from('tenant_channel_settings').upsert({
    client_id: client.id,
    org_id: client.id,
    provider: 'meta',
    whatsapp_phone_number_id: phoneNumberId,
    whatsapp_waba_id: wabaId,
    whatsapp_access_token: encryptedToken,
    is_active: isActive,
    whatsapp_config: { phone_number_id: phoneNumberId, waba_id: wabaId, provider: 'meta' },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })
  if (error) {
    console.error('[whatsapp settings]', error)
    return { success: false, error: 'Impossibile salvare la configurazione WhatsApp' }
  }
  return { success: true }
}
