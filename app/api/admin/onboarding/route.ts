import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin' || data?.role === 'super_admin' ? user : null
}

export async function POST(request: Request) {
  const user = await getAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const form = await request.formData()
    const clientId = String(form.get('clientId') || '')
    if (!clientId) return NextResponse.json({ error: 'clientId è obbligatorio' }, { status: 400 })
    const admin = createAdminClient()
    const { data: client } = await admin.from('clients').select('id').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
    const json = (name: string, fallback: unknown) => { try { return JSON.parse(String(form.get(name) || JSON.stringify(fallback))) } catch { return fallback } }
    const settings = { client_id: clientId, website_url: String(form.get('websiteUrl') || ''), sms_sender_name: String(form.get('smsSenderName') || ''), description: String(form.get('description') || ''), social_links: json('socialLinks', {}), address: String(form.get('address') || ''), city: String(form.get('city') || ''), postal_code: String(form.get('postalCode') || ''), province: String(form.get('province') || ''), country: String(form.get('country') || 'IT'), regular_hours: json('regularHours', {}), special_hours: json('specialHours', []), updated_at: new Date().toISOString() }
    const { error: settingsError } = await admin.from('business_settings').upsert(settings, { onConflict: 'client_id' })
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 })

    const channels = { client_id: clientId, vapi_config: json('vapiConfig', {}), meta_config: json('metaConfig', {}), whatsapp_config: json('whatsappConfig', {}), chatbot_config: json('chatbotConfig', {}), updated_at: new Date().toISOString() }
    const { error: channelsError } = await admin.from('tenant_channel_settings').upsert(channels, { onConflict: 'client_id' })
    if (channelsError) return NextResponse.json({ error: channelsError.message }, { status: 400 })

    const departments = json('departments', []) as Array<{ name?: string; description?: string; routingTarget?: string }>
    if (departments.length) {
      await admin.from('business_departments').delete().eq('client_id', clientId)
      const { error } = await admin.from('business_departments').insert(departments.filter((department) => department.name?.trim()).map((department) => ({ client_id: clientId, name: department.name!.trim(), description: department.description || null, routing_target: department.routingTarget || null })))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const faqs = json('faqs', []) as Array<{ question?: string; answer?: string; active?: boolean }>
    if (faqs.length) {
      await admin.from('business_faqs').delete().eq('client_id', clientId)
      const { error } = await admin.from('business_faqs').insert(faqs.filter((faq) => faq.question?.trim() && faq.answer?.trim()).map((faq) => ({ client_id: clientId, question: faq.question!.trim(), answer: faq.answer!.trim(), active: faq.active !== false })))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const files = [form.get('ragDocument1'), form.get('ragDocument2')].filter((file): file is File => file instanceof File && file.size > 0)
    if (files.length) {
      const { data: bucket } = await admin.storage.getBucket('knowledge-base')
      if (!bucket) {
        const { error } = await admin.storage.createBucket('knowledge-base', { public: false })
        if (error && !error.message.toLowerCase().includes('already exists')) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    const documents = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: `${file.name} supera 10 MB` }, { status: 413 })
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${clientId}/${crypto.randomUUID()}-${safeName}`
      const upload = await admin.storage.from('knowledge-base').upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 })
      const { data: document, error } = await admin.from('knowledge_documents').insert({ client_id: clientId, uploaded_by: user.id, file_name: file.name, storage_path: path, mime_type: file.type || null, status: 'queued' }).select('*').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      documents.push(document)
    }
    return NextResponse.json({ success: true, documents })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Salvataggio onboarding fallito' }, { status: 500 }) }
}
