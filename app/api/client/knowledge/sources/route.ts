import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { captureObservedException, captureObservedMessage } from '@/lib/observability/sentry'
import { createKnowledgeUploadUrl } from '@/lib/storage/r2'
import { inngest } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

async function currentClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, client: null }
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  return { user, client }
}

async function findReadyDuplicate(admin: ReturnType<typeof createAdminClient>, orgId: string, hash: string) {
  const { data, error } = await admin.from('knowledge_sources').select('id,type,source_value,status,content_hash,created_at,updated_at').eq('org_id', orgId).eq('content_hash', hash).eq('status', 'ready').maybeSingle()
  if (error) throw error
  return data
}

export async function GET() {
  const { client } = await currentClient()
  if (!client) return NextResponse.json({ error: 'Non autenticato o cliente non trovato' }, { status: 401 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('knowledge_sources').select('id,type,source_value,status,content_hash,error_message,created_at,updated_at').eq('org_id', client.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data || [] })
}

export async function POST(request: Request) {
  const { user, client } = await currentClient()
  if (!user || !client) return NextResponse.json({ error: 'Non autenticato o cliente non trovato' }, { status: 401 })
  const admin = createAdminClient()
  const payload = await request.json().catch(() => ({})) as { url?: string; fileName?: string; mimeType?: string; fileSize?: number; contentHash?: string }
  const isFile = Boolean(payload.fileName)

  try {
    if (isFile) {
      const fileName = payload.fileName!.trim()
      const fileSize = Number(payload.fileSize || 0)
      const hash = payload.contentHash?.trim()
      if (!fileName || !hash) return NextResponse.json({ error: 'fileName e contentHash sono obbligatori' }, { status: 400 })
      if (!fileSize || fileSize > 50 * 1024 * 1024) return NextResponse.json({ error: 'Il file è vuoto o supera il limite di 50 MB' }, { status: 413 })
      const duplicate = await findReadyDuplicate(admin, client.id, hash)
      if (duplicate) return NextResponse.json({ duplicate: true, source: duplicate, message: 'Documento già indicizzato: nessun nuovo embedding creato.' }, { status: 200 })
      const sourceId = crypto.randomUUID()
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const sourceValue = `${client.id}/${sourceId}/${safeName}`
      const { data: source, error: sourceError } = await admin.from('knowledge_sources').insert({ id: sourceId, org_id: client.id, type: 'file', source_value: sourceValue, status: 'pending', content_hash: hash }).select('*').single()
      if (sourceError || !source) throw sourceError || new Error('Knowledge source non creata')
      const uploadUrl = await createKnowledgeUploadUrl(sourceValue, payload.mimeType || 'application/octet-stream')
      captureObservedMessage('Knowledge source created', 'info', client.id, { sourceId, type: 'file' })
      return NextResponse.json({ source, uploadRequired: true, uploadUrl, expiresIn: 900 }, { status: 202 })
    }

    const url = payload.url?.trim()
    if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'URL http/https non valido' }, { status: 400 })
    const { data: existingUrl, error: existingUrlError } = await admin.from('knowledge_sources').select('id,type,source_value,status,content_hash,created_at,updated_at').eq('org_id', client.id).eq('type', 'url').eq('source_value', url).eq('status', 'ready').maybeSingle()
    if (existingUrlError) throw existingUrlError
    if (existingUrl) return NextResponse.json({ duplicate: true, source: existingUrl, message: 'URL già indicizzato: nessun nuovo embedding creato.' }, { status: 200 })
    const sourceId = crypto.randomUUID()
    const { data: source, error: sourceError } = await admin.from('knowledge_sources').insert({ id: sourceId, org_id: client.id, type: 'url', source_value: url, status: 'pending' }).select('*').single()
    if (sourceError || !source) throw sourceError || new Error('Knowledge source non creata')
    try {
      await inngest.send({ name: 'knowledge/source.created', data: { sourceId, orgId: client.id, type: 'url', sourceValue: url } })
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message.slice(0, 1000) : 'Avvio elaborazione fallito'
      await admin.from('knowledge_sources').update({ status: 'error', error_message: message, updated_at: new Date().toISOString() }).eq('id', sourceId).eq('org_id', client.id)
      throw dispatchError
    }
    captureObservedMessage('Knowledge source queued', 'info', client.id, { sourceId, type: 'url' })
    return NextResponse.json({ source, queued: true }, { status: 202 })
  } catch (error) {
    captureObservedException(error, client.id, { feature: 'knowledge-ingestion-queue' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Accodamento ingestion fallito' }, { status: 500 })
  }
}
