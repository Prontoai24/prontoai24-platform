import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function canManage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin' || data?.role === 'super_admin'
}

async function vapi(path: string, init: RequestInit = {}) {
  const key = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY
  if (!key) throw new Error('VAPI_PRIVATE_KEY non configurata')
  const response = await fetch(`https://api.vapi.ai${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Vapi ${response.status}: ${body?.message || body?.error || 'richiesta rifiutata'}`)
  return body
}

export async function POST(request: Request) {
  if (!(await canManage())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const { clientId, phoneNumber, assistant, assistantId: existingAssistantId, phoneNumberId } = await request.json()
    if (!clientId || !phoneNumber) return NextResponse.json({ error: 'clientId e phoneNumber sono obbligatori' }, { status: 400 })
    if (!process.env.TELNYX_CONNECTION_ID) return NextResponse.json({ error: 'TELNYX_CONNECTION_ID non configurato' }, { status: 503 })

    const adminClient = createAdminClient()
    const { data: client } = await adminClient.from('clients').select('id, company_name, contact_email').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })

    const createdAssistant = existingAssistantId ? { id: existingAssistantId } : await vapi('/assistant', { method: 'POST', body: JSON.stringify({ name: assistant?.name || `ProntoAI24 - ${client.company_name || client.id}`, firstMessage: assistant?.firstMessage || 'Come posso aiutarti?', model: assistant?.model || { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: `Sei l'assistente vocale di ${client.company_name || 'questo cliente'}.` }] }, voice: assistant?.voice || { provider: '11labs', voiceId: 'rachel' }, ...assistant }) })
    const importedPhone = await vapi('/phone-number', { method: 'POST', body: JSON.stringify({ provider: 'telnyx', number: phoneNumber, telnyxConnectionId: process.env.TELNYX_CONNECTION_ID, assistantId: createdAssistant.id }) })

    const { error: saveError } = await adminClient.from('phone_numbers').upsert({ ...(phoneNumberId ? { id: phoneNumberId } : {}), client_id: clientId, phone_number: phoneNumber, vapi_phone_id: importedPhone.id || importedPhone.phoneNumberId, vapi_assistant_id: createdAssistant.id, telnyx_number_id: importedPhone.telnyxPhoneNumberId || null, ...(phoneNumberId ? {} : { status: 'active' }), status_updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (saveError) return NextResponse.json({ error: `Provisioning Vapi completato ma salvataggio locale fallito: ${saveError.message}`, assistant: createdAssistant, phone: importedPhone }, { status: 500 })

    return NextResponse.json({ success: true, clientId, assistant: createdAssistant, phoneNumber: importedPhone })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provisioning Vapi fallito' }, { status: 502 })
  }
}

export async function PUT(request: Request) {
  if (!(await canManage())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const { phoneNumberId, assistantId } = await request.json()
    if (!phoneNumberId || !assistantId) return NextResponse.json({ error: 'phoneNumberId e assistantId sono obbligatori' }, { status: 400 })
    return NextResponse.json({ success: true, phone: await vapi(`/phone-number/${encodeURIComponent(phoneNumberId)}`, { method: 'PATCH', body: JSON.stringify({ assistantId }) }) })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Binding Vapi fallito' }, { status: 502 }) }
}
