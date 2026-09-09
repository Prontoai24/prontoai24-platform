import { createAdminClient } from '@/lib/supabase/server'

type WhatsAppConfig = {
  provider?: 'meta'
  access_token?: string
  phone_number_id?: string
  display_phone_number?: string
  api_version?: string
}

function configValue(config: WhatsAppConfig, key: keyof WhatsAppConfig, fallback?: string) {
  const value = config[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export async function getWhatsAppConfig(clientId: string): Promise<Required<Pick<WhatsAppConfig, 'access_token' | 'phone_number_id'>> & WhatsAppConfig> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('tenant_channel_settings').select('whatsapp_config').eq('client_id', clientId).maybeSingle()
  if (error) throw new Error(`Configurazione WhatsApp non leggibile: ${error.message}`)
  const tenantConfig = (data?.whatsapp_config || {}) as WhatsAppConfig
  const accessToken = configValue(tenantConfig, 'access_token', process.env.WHATSAPP_ACCESS_TOKEN)
  const phoneNumberId = configValue(tenantConfig, 'phone_number_id', process.env.WHATSAPP_PHONE_NUMBER_ID)
  if (!accessToken || !phoneNumberId) throw new Error('WhatsApp Meta non configurato: servono access token e phone number ID')
  return { ...tenantConfig, access_token: accessToken, phone_number_id: phoneNumberId }
}

export async function sendWhatsAppText(input: { clientId: string; to: string; body: string; providerMessageId?: string }) {
  const config = await getWhatsAppConfig(input.clientId)
  const version = configValue(config, 'api_version', process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0')
  const response = await fetch(`https://graph.facebook.com/${version}/${config.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: input.to, type: 'text', text: { preview_url: false, body: input.body } }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Meta Graph API error (${response.status})`)
  return { providerMessageId: payload.messages?.[0]?.id || input.providerMessageId || null, raw: payload }
}

export async function sendWhatsAppTemplate(input: { clientId: string; to: string; templateName: string; languageCode?: string; components?: unknown[] }) {
  const config = await getWhatsAppConfig(input.clientId)
  const version = configValue(config, 'api_version', process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0')
  const response = await fetch(`https://graph.facebook.com/${version}/${config.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: input.to, type: 'template', template: { name: input.templateName, language: { code: input.languageCode || 'it' }, components: input.components || [] } }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Meta Graph API error (${response.status})`)
  return { providerMessageId: payload.messages?.[0]?.id || null, raw: payload }
}
