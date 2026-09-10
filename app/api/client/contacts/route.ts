import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function tenant() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, client: null, response: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) return { supabase, client: null, response: NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 }) }
  return { supabase, client, response: null }
}

export async function GET(request: Request) {
  const { supabase, client, response } = await tenant(); if (response || !client) return response
  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim()
  const listId = url.searchParams.get('listId')
  const format = url.searchParams.get('format')
  let query = supabase.from('contacts').select('id, client_id, list_id, first_name, last_name, email, phone, messenger, instagram, notes, stage, created_at, updated_at, contact_lists(name)').eq('client_id', client.id).order('updated_at', { ascending: false })
  if (listId) query = query.eq('list_id', listId)
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  const [{ data: contacts, error }, { data: lists, error: listsError }] = await Promise.all([query, supabase.from('contact_lists').select('id, name, description').eq('client_id', client.id).order('name'),])
  if (error || listsError) return NextResponse.json({ error: error?.message || listsError?.message }, { status: 500 })
  if (format === 'csv') {
    const rows = (contacts ?? []).map((item: any) => [item.first_name, item.last_name ?? '', item.email ?? '', item.phone ?? '', item.messenger ?? '', item.instagram ?? '', item.stage, item.notes ?? ''])
    const csv = [['Nome', 'Cognome', 'Email', 'Telefono', 'Messenger', 'Instagram', 'Stato', 'Note'], ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    return new Response(`\ufeff${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="prontoai24-contatti.csv"' } })
  }
  return NextResponse.json({ contacts: contacts ?? [], lists: lists ?? [] })
}

export async function POST(request: Request) {
  const { supabase, client, response } = await tenant(); if (response || !client) return response
  const body = await request.json() as Record<string, unknown>
  if (body.action === 'create-list') {
    const { data, error } = await supabase.from('contact_lists').insert({ client_id: client.id, name: body.name, description: body.description || null }).select('id, name, description').single()
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ list: data }, { status: 201 })
  }
  const payload = { client_id: client.id, list_id: body.list_id || null, first_name: body.first_name, last_name: body.last_name || null, email: body.email || null, phone: body.phone || null, messenger: body.messenger || null, instagram: body.instagram || null, notes: body.notes || null, stage: body.stage || 'Nuovo' }
  if (!payload.first_name) return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 })
  const { data, error } = await supabase.from('contacts').insert(payload).select('*').single()
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ contact: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, client, response } = await tenant(); if (response || !client) return response
  const body = await request.json() as Record<string, unknown>
  const { id, ...changes } = body
  if (!id) return NextResponse.json({ error: 'ID contatto mancante' }, { status: 400 })
  delete changes.client_id
  const { data, error } = await supabase.from('contacts').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).eq('client_id', client.id).select('*').single()
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ contact: data })
}

export async function DELETE(request: Request) {
  const { supabase, client, response } = await tenant(); if (response || !client) return response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID contatto mancante' }, { status: 400 })
  const { error } = await supabase.from('contacts').delete().eq('id', id).eq('client_id', client.id)
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
