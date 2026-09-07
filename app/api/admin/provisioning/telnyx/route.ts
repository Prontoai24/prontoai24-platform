import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin' || data?.role === 'super_admin'
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const key = process.env.TELNYX_API_KEY
  if (!key) return NextResponse.json({ error: 'TELNYX_API_KEY non configurata' }, { status: 503 })
  const url = new URL('https://api.telnyx.com/v2/available_phone_numbers')
  new URL(request.url).searchParams.forEach((value, keyName) => url.searchParams.set(keyName, value))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
  return NextResponse.json(await response.json(), { status: response.status })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const key = process.env.TELNYX_API_KEY
  if (!key) return NextResponse.json({ error: 'TELNYX_API_KEY non configurata' }, { status: 503 })
  const { phoneNumbers, connectionId, messagingProfileId } = await request.json()
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) return NextResponse.json({ error: 'phoneNumbers è obbligatorio' }, { status: 400 })
  const resolvedConnectionId = connectionId || process.env.TELNYX_CONNECTION_ID
  const resolvedMessagingProfileId = messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID
  const response = await fetch('https://api.telnyx.com/v2/number_orders', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phone_numbers: phoneNumbers.map((phoneNumber: string) => ({ phone_number: phoneNumber })), ...(resolvedConnectionId ? { connection_id: resolvedConnectionId } : {}), ...(resolvedMessagingProfileId ? { messaging_profile_id: resolvedMessagingProfileId } : {}) }) })
  return NextResponse.json(await response.json(), { status: response.status })
}
