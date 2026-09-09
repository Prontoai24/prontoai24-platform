import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 180

export function chunkText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE)
    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }
  return chunks
}

export function contentHash(content: string | Buffer | Uint8Array) {
  const value = typeof content === 'string' ? content.replace(/\s+/g, ' ').trim() : content
  return crypto.createHash('sha256').update(value).digest('hex')
}

function unstructuredConfig() {
  const rawUrl = process.env.UNSTRUCTURED_API_URL?.trim()
  const apiKey = process.env.UNSTRUCTURED_API_KEY?.trim()
  if (!rawUrl || !apiKey) {
    const missing = [!rawUrl && 'UNSTRUCTURED_API_URL', !apiKey && 'UNSTRUCTURED_API_KEY'].filter(Boolean).join(', ')
    console.error('[knowledge] Unstructured configuration missing', { missing })
    throw new Error(`Configurazione Unstructured incompleta: manca ${missing}`)
  }

  let base: URL
  try {
    base = new URL(rawUrl)
  } catch {
    console.error('[knowledge] Invalid UNSTRUCTURED_API_URL')
    throw new Error('UNSTRUCTURED_API_URL non è un URL valido')
  }
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('UNSTRUCTURED_API_URL deve usare http o https')

  const pathname = base.pathname.replace(/\/+$/, '')
  if (pathname.endsWith('/api/v1/partition') || pathname.endsWith('/general/v0/general')) base.pathname = pathname
  else if (pathname.endsWith('/api/v1')) base.pathname = `${pathname}/partition`
  else base.pathname = `${pathname}/api/v1/partition`
  base.search = ''
  return { endpoint: base.toString(), apiKey }
}

export async function crawlUrl(url: string) {
  if (process.env.FIRECRAWL_API_KEY) {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    })
    if (!response.ok) throw new Error(`Firecrawl HTTP ${response.status}`)
    const data = await response.json() as any
    const markdown = data.data?.markdown || data.markdown
    if (!markdown) throw new Error('Firecrawl non ha restituito contenuto')
    return String(markdown)
  }

  const response = await fetch(url, { headers: { 'user-agent': 'ProntoAI24-KnowledgeBot/1.0' } })
  if (!response.ok) throw new Error(`URL HTTP ${response.status}`)
  const html = await response.text()
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
}

export async function parseFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const { endpoint, apiKey } = unstructuredConfig()
  const form = new FormData()
  form.append('files', new Blob([buffer], { type: file.type || 'application/octet-stream' }), file.name)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'unstructured-api-key': apiKey },
    body: form,
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    console.error('[knowledge] Unstructured parsing failed', { endpoint, status: response.status, detail })
    throw new Error(`Unstructured HTTP ${response.status}`)
  }
  const elements = await response.json() as Array<{ text?: string }>
  const text = elements.map((element) => element.text || '').filter(Boolean).join('\n')
  if (!text.trim()) throw new Error('Unstructured non ha restituito testo estraibile')
  return text
}

export async function embedTexts(texts: string[]) {
  if (!process.env.OPENAI_API_KEY) return null
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small', input: texts }),
  })
  if (!response.ok) throw new Error(`Embeddings HTTP ${response.status}`)
  const data = await response.json() as any
  return (data.data || []).sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding as number[])
}

export async function indexKnowledgeSource(sourceId: string, orgId: string, text: string, metadata: Record<string, unknown> = {}, precomputedHash?: string) {
  const admin = createAdminClient()
  const chunks = chunkText(text)
  if (!chunks.length) throw new Error('Nessun testo estraibile')
  const embeddings = await embedTexts(chunks)
  await admin.from('knowledge_chunks').delete().eq('source_id', sourceId)
  const rows = chunks.map((content, index) => ({ source_id: sourceId, org_id: orgId, chunk_index: index, content, embedding: embeddings?.[index] ? `[${embeddings[index].join(',')}]` : null, metadata }))
  const { error } = await admin.from('knowledge_chunks').insert(rows)
  if (error) throw error
  const { error: sourceError } = await admin.from('knowledge_sources').update({ status: embeddings ? 'ready' : 'error', error_message: embeddings ? null : 'OPENAI_API_KEY non configurata: contenuto estratto ma embedding non creato', content_hash: precomputedHash || contentHash(text), updated_at: new Date().toISOString() }).eq('id', sourceId)
  if (sourceError) throw sourceError
  return { chunks: chunks.length, embedded: Boolean(embeddings) }
}

export async function retrieveKnowledge(orgId: string, query: string, limit = 6) {
  const embeddings = await embedTexts([query])
  if (embeddings?.[0]) {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('match_knowledge_chunks', { query_embedding: `[${embeddings[0].join(',')}]`, match_org_id: orgId, match_threshold: Number(process.env.RAG_MATCH_THRESHOLD || 0.35), match_count: limit })
    if (error) throw error
    return data || []
  }
  const admin = createAdminClient()
  const { data } = await admin.from('knowledge_chunks').select('id,source_id,content,metadata').eq('org_id', orgId).limit(limit)
  return data || []
}
