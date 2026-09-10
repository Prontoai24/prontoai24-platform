import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>

export const dynamic = 'force-dynamic'

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9àèéìòù]/g, '')
const mapField = (key: string) => {
  const value = normalize(key)
  if (['nome', 'firstname', 'name'].includes(value)) return 'first_name'
  if (['cognome', 'lastname', 'surname'].includes(value)) return 'last_name'
  if (['email', 'emailaddress', 'mail'].includes(value)) return 'email'
  if (['telefono', 'phone', 'mobile', 'cellulare', 'whatsapp'].includes(value)) return 'phone'
  if (['messenger', 'facebook'].includes(value)) return 'messenger'
  if (['instagram', 'ig'].includes(value)) return 'instagram'
  if (['note', 'notes', 'commenti'].includes(value)) return 'notes'
  if (['stato', 'stage', 'status'].includes(value)) return 'stage'
  return null
}

async function getTenant(request: Request) {
  const authorization = request.headers.get('authorization')
  const supabase = authorization
    ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: authorization } } })
    : createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, client: null }
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  return { supabase, client }
}

export async function POST(request: Request) {
  const { supabase, client } = await getTenant(request)
  if (!client) return NextResponse.json({ error: 'Non autenticato o tenant non trovato' }, { status: 401 })
  const form = await request.formData()
  const file = form.get('file')
  const listId = String(form.get('listId') || '') || null
  if (!(file instanceof File)) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: Record<string, unknown>[] = []
  const extension = file.name.toLowerCase().split('.').pop()
  try {
    if (extension === 'pdf') {
      const parsed = await pdfParse(buffer)
      rows = parsed.text.split(/\r?\n/).map((line) => line.split(/[;,\t|]/)).filter((parts) => parts.length >= 2 && parts.some(Boolean)).map((parts) => ({ first_name: parts[0], last_name: parts[1], email: parts[2], phone: parts[3], notes: parts.slice(4).join(' ') }))
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      rows = raw.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [mapField(key) || key, value])))
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Parsing fallito' }, { status: 422 }) }
  const contacts = rows.map((row) => ({ client_id: client.id, list_id: listId, first_name: String(row.first_name || row.name || '').trim(), last_name: String(row.last_name || '').trim() || null, email: String(row.email || '').trim() || null, phone: String(row.phone || '').trim() || null, messenger: String(row.messenger || '').trim() || null, instagram: String(row.instagram || '').trim() || null, notes: String(row.notes || '').trim() || null, stage: ['Nuovo', 'Da contattare', 'In corso', 'Cliente'].includes(String(row.stage)) ? String(row.stage) : 'Nuovo' })).filter((row) => row.first_name)
  if (!contacts.length) return NextResponse.json({ error: 'Nessun contatto riconosciuto. Usa il template ufficiale.' }, { status: 422 })
  const { data, error } = await supabase.from('contacts').insert(contacts).select('id')
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 })
}
