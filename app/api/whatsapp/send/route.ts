import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { to?: string; text?: string; conversationId?: string; orgId?: string }
  if (!body.to || !body.text) return NextResponse.json({ error: 'to e text sono obbligatori' }, { status: 400 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role
  let orgId = body.orgId
  if (role === 'client') {
    const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
    if (!client) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 403 })
    orgId = client.id
  } else if (role === 'admin') {
    if (!orgId) return NextResponse.json({ error: 'orgId obbligatorio per un admin' }, { status: 400 })
    const { data: client } = await supabase.from('clients').select('id').eq('id', orgId).eq('managed_by_admin', user.id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Tenant non autorizzato' }, { status: 403 })
  } else if (role !== 'super_admin' || !orgId) {
    return NextResponse.json({ error: 'Tenant non autorizzato' }, { status: 403 })
  }
  await inngest.send({ name: 'whatsapp/message.send.requested', data: { org_id: orgId, to: body.to, body: body.text, conversation_id: body.conversationId } })
  return NextResponse.json({ queued: true, org_id: orgId })
}
