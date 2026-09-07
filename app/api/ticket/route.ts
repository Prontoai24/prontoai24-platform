import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: tickets, error } = await supabase.from('tickets').select('id, subject, description, priority, status, created_at, updated_at, clients(company_name)').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ tickets })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const body = await request.json()
  const { subject, description, priority = 'normal', clientId } = body
  if (!subject || !description) return NextResponse.json({ error: 'subject e description sono obbligatori' }, { status: 400 })

  let resolvedClientId = clientId
  if (profile?.role === 'client') {
    const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
    resolvedClientId = client?.id
  }
  if (!resolvedClientId) return NextResponse.json({ error: 'Cliente non specificato' }, { status: 400 })
  if (profile?.role === 'client') {
    const { data: owned } = await supabase.from('clients').select('id').eq('id', resolvedClientId).eq('profile_id', user.id).single()
    if (!owned) return NextResponse.json({ error: 'Cliente non autorizzato' }, { status: 403 })
  }
  const adminClient = createAdminClient()
  const { data: ticket, error } = await adminClient.from('tickets').insert({ client_id: resolvedClientId, created_by: user.id, subject, description, priority }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await adminClient.from('audit_logs').insert({ actor_id: user.id, action: 'ticket.created', entity_type: 'ticket', entity_id: ticket.id, metadata: { priority } })
  return NextResponse.json({ ticket }, { status: 201 })
}
