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

async function telnyx(path: string, init: RequestInit = {}) {
  const key = process.env.TELNYX_API_KEY
  if (!key) throw new Error('TELNYX_API_KEY non configurata')
  const response = await fetch(`https://api.telnyx.com/v2${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) }, cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Telnyx ${response.status}: ${body?.errors?.[0]?.detail || body?.error || 'richiesta rifiutata'}`)
  return body
}

export async function POST(request: Request) {
  const user = await getAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  try {
    const form = await request.formData()
    const clientId = String(form.get('clientId') || '')
    const phoneNumberType = String(form.get('phoneNumberType') || 'local')
    const action = String(form.get('action') || 'ordering')
    const customerReference = String(form.get('customerReference') || clientId)
    const requirementValues = JSON.parse(String(form.get('requirements') || '{}')) as Record<string, unknown>
    if (!clientId) return NextResponse.json({ error: 'clientId è obbligatorio' }, { status: 400 })
    if (!['local', 'national', 'mobile', 'toll_free', 'shared_cost'].includes(phoneNumberType)) return NextResponse.json({ error: 'phoneNumberType non valido' }, { status: 400 })
    if (action !== 'ordering') return NextResponse.json({ error: 'Per ora è supportata solo l’azione ordering' }, { status: 400 })

    const group = await telnyx('/requirement_groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country_code: 'IT', phone_number_type: phoneNumberType, action, customer_reference: customerReference }) })
    const groupData = group.data || group
    const documentIds: string[] = []
    for (const fieldName of ['companyDocument', 'representativeDocument']) {
      const file = form.get(fieldName)
      if (!(file instanceof File) || file.size === 0) continue
      const documentForm = new FormData()
      documentForm.set('file', file, file.name)
      documentForm.set('document_type', fieldName === 'companyDocument' ? 'business_registration' : 'identity_document')
      const uploaded = await telnyx('/documents', { method: 'POST', headers: {}, body: documentForm })
      const document = uploaded.data || uploaded
      if (document.id) documentIds.push(document.id)
    }

    if (Object.keys(requirementValues).length || documentIds.length) {
      const requirements = { ...requirementValues, document_ids: documentIds }
      await telnyx(`/requirement_groups/${encodeURIComponent(groupData.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements }) })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('clients').update({ telnyx_requirement_group_id: groupData.id, updated_at: new Date().toISOString() }).eq('id', clientId)
    if (error) return NextResponse.json({ error: `Requirement group creato ma salvataggio locale fallito: ${error.message}`, requirementGroup: groupData }, { status: 500 })
    return NextResponse.json({ success: true, requirementGroup: groupData, documentIds })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Compliance Telnyx fallita' }, { status: 502 }) }
}
