import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTransactionalSms } from '@/lib/telnyx/sms'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  try {
    const body = await request.json()
    if (!body.clientId || !body.toNumber || !body.body) return NextResponse.json({ error: 'clientId, toNumber e body sono obbligatori' }, { status: 400 })
    return NextResponse.json({ success: true, sms: await sendTransactionalSms({ clientId: body.clientId, toNumber: body.toNumber, body: body.body, fromNumber: body.fromNumber }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invio SMS fallito' }, { status: 502 })
  }
}
