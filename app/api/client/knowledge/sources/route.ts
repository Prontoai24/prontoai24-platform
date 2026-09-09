import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { captureObservedException, captureObservedMessage } from '@/lib/observability/sentry'
import { crawlUrl, indexKnowledgeSource, parseFile } from '@/lib/knowledge/ingestion'

export const dynamic = 'force-dynamic'

async function currentClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, client: null }
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  return { user, client }
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
  const contentType = request.headers.get('content-type') || ''
  let type: 'url' | 'file'
  let sourceValue: string
  let text: string
  let metadata: Record<string, unknown> = {}

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return NextResponse.json({ error: 'File mancante' }, { status: 400 })
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Il file supera il limite di 10 MB' }, { status: 413 })
      type = 'file'
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      sourceValue = `${client.id}/${crypto.randomUUID()}-${safeName}`
      const { data: bucket } = await admin.storage.getBucket('knowledge-base')
      if (!bucket) {
        const { error: bucketError } = await admin.storage.createBucket('knowledge-base', { public: false })
        if (bucketError && !bucketError.message.toLowerCase().includes('already exists')) throw bucketError
      }
      const upload = await admin.storage.from('knowledge-base').upload(sourceValue, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upload.error) throw upload.error
      text = await parseFile(file)
      metadata = { file_name: file.name, mime_type: file.type || null, storage_path: sourceValue }
    } else {
      const payload = await request.json() as { url?: string }
      if (!payload.url || !/^https?:\/\//i.test(payload.url)) return NextResponse.json({ error: 'URL http/https non valido' }, { status: 400 })
      type = 'url'
      sourceValue = payload.url
      text = await crawlUrl(payload.url)
      metadata = { url: payload.url, crawler: process.env.FIRECRAWL_API_KEY ? 'firecrawl' : 'direct-fetch-fallback' }
    }

    const { data: source, error: sourceError } = await admin.from('knowledge_sources').insert({ org_id: client.id, type, source_value: sourceValue, status: 'processing' }).select('*').single()
    if (sourceError || !source) throw sourceError || new Error('Knowledge source non creata')
    const result = await indexKnowledgeSource(source.id, client.id, text, metadata)
    captureObservedMessage('Knowledge source indexed', 'info', client.id, { sourceId: source.id, type, chunks: result.chunks, embedded: result.embedded })
    return NextResponse.json({ source: { ...source, status: result.embedded ? 'ready' : 'error' }, result }, { status: 201 })
  } catch (error) {
    captureObservedException(error, client.id, { feature: 'knowledge-ingestion' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Indicizzazione fallita' }, { status: 500 })
  }
}
