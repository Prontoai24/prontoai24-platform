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

function telnyxHeaders() {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error('TELNYX_API_KEY non configurata')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function telnyx(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.telnyx.com/v2${path}`, { ...init, headers: { ...telnyxHeaders(), ...(init.headers || {}) }, cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Telnyx ${response.status}: ${body?.errors?.[0]?.detail || body?.error || 'richiesta rifiutata'}`)
  return body
}

export async function GET(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const url = new URL('https://api.telnyx.com/v2/available_phone_numbers')
    new URL(request.url).searchParams.forEach((value, key) => url.searchParams.set(key, value))
    const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY || ''}` }, cache: 'no-store' })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Ricerca numeri fallita' }, { status: 502 }) }
}

export async function POST(request: Request) {
  const user = await getAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const { phoneNumbers, connectionId, messagingProfileId, requirementGroupId, clientId } = await request.json()
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) return NextResponse.json({ error: 'phoneNumbers è obbligatorio' }, { status: 400 })
    if (phoneNumbers.some((value) => typeof value !== 'string' || !value.startsWith('+39'))) return NextResponse.json({ error: 'Sono ammessi solo numeri italiani +39' }, { status: 400 })
    const resolvedConnectionId = connectionId || process.env.TELNYX_CONNECTION_ID
    const resolvedMessagingProfileId = messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID
    const result = await telnyx('/number_orders', { method: 'POST', body: JSON.stringify({ phone_numbers: phoneNumbers.map((phoneNumber: string) => ({ phone_number: phoneNumber, ...(requirementGroupId ? { requirement_group_id: requirementGroupId } : {}) })), ...(resolvedConnectionId ? { connection_id: resolvedConnectionId } : {}), ...(resolvedMessagingProfileId ? { messaging_profile_id: resolvedMessagingProfileId } : {}) }) })
    const order = result.data || result
    if (clientId) {
      const admin = createAdminClient()
      const rows = phoneNumbers.map((phoneNumber: string) => ({ client_id: clientId, phone_number: phoneNumber, telnyx_order_id: order.id || null, requirement_group_id: requirementGroupId || null, messaging_profile_id: resolvedMessagingProfileId || null, compliance_status: 'pending', status: 'pending', status_updated_at: new Date().toISOString() }))
      const { error } = await admin.from('phone_numbers').upsert(rows, { onConflict: 'id' })
      if (error) return NextResponse.json({ error: `Ordine Telnyx creato ma salvataggio locale fallito: ${error.message}`, order }, { status: 500 })
    }
    return NextResponse.json({ success: true, order })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Ordine Telnyx fallito' }, { status: 502 }) }
}
