import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const body = await request.json()
  const { companyName, vatNumber, fiscalCode, contactEmail, contactPhone, billingAddress, status = 'in_setup', managedByAdmin = user.id } = body
  if (!contactEmail) return NextResponse.json({ error: 'contactEmail è obbligatoria' }, { status: 400 })
  if (profile.role === 'admin' && managedByAdmin !== user.id) return NextResponse.json({ error: 'Un admin può assegnare solo a se stesso' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data: client, error } = await adminClient.from('clients').insert({
    company_name: companyName || null,
    vat_number: vatNumber || null,
    fiscal_code: fiscalCode || null,
    contact_email: contactEmail,
    contact_phone: contactPhone || null,
    billing_address: billingAddress || null,
    status,
    managed_by_admin: managedByAdmin,
  }).select('id, company_name, contact_email, status').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await adminClient.from('audit_logs').insert({ actor_id: user.id, action: 'client.created', entity_type: 'client', entity_id: client.id, metadata: { contactEmail } })
  return NextResponse.json({ success: true, client }, { status: 201 })
}
