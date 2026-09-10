import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WhatsAppSettingsForm from './WhatsAppSettingsForm'

export const dynamic = 'force-dynamic'

export default async function ChannelSettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/client/login')
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) redirect('/client')
  const { data: settings } = await supabase.from('tenant_channel_settings').select('whatsapp_phone_number_id, whatsapp_waba_id, is_active').eq('org_id', client.id).eq('provider', 'meta').maybeSingle()
  return <main className="min-h-screen bg-[#f7fbff] px-6 py-10 text-[var(--ink)]"><div className="mx-auto max-w-2xl"><Link href="/client" className="text-sm font-bold text-[var(--blue)]">← Torna alla dashboard</Link><WhatsAppSettingsForm initialPhoneNumberId={settings?.whatsapp_phone_number_id || ''} initialWabaId={settings?.whatsapp_waba_id || ''} isActive={Boolean(settings?.is_active)} /></div></main>
}
