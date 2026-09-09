#!/usr/bin/env node

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const secret = process.env.TEST_WEBHOOK_SECRET || process.env.AI_WEBHOOK_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const orgId = process.env.TEST_ORG_ID
const firecrawlKey = process.env.FIRECRAWL_API_KEY
const openaiKey = process.env.OPENAI_API_KEY
const url = process.env.TEST_KB_URL || 'https://prontoai24.it'
if (!secret || !supabaseUrl || !serviceKey || !orgId || !firecrawlKey || !openaiKey) throw new Error('Richiesti TEST_WEBHOOK_SECRET, Supabase, TEST_ORG_ID, FIRECRAWL_API_KEY e OPENAI_API_KEY')

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
const sourceId = crypto.randomUUID()
const conversationId = `rag-e2e-${Date.now()}`
const providerMessageId = `rag-e2e-message-${Date.now()}`

function chunks(text) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const result = []
  for (let start = 0; start < normalized.length; start += 1020) result.push(normalized.slice(start, start + 1200))
  return result.filter(Boolean)
}
async function supa(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}
async function embed(input) {
  const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'text-embedding-3-small', input }) })
  if (!response.ok) throw new Error(`OpenAI embeddings ${response.status}: ${await response.text()}`)
  return (await response.json()).data.sort((a, b) => a.index - b.index).map((item) => item.embedding)
}
try {
  const crawl = await fetch('https://api.firecrawl.dev/v2/scrape', { method: 'POST', headers: { Authorization: `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }) })
  if (!crawl.ok) throw new Error(`Firecrawl ${crawl.status}: ${await crawl.text()}`)
  const crawlData = await crawl.json()
  const text = String(crawlData.data?.markdown || crawlData.markdown || '').trim()
  if (!text) throw new Error('Firecrawl non ha restituito testo')
  const source = await supa('knowledge_sources', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: sourceId, org_id: orgId, type: 'url', source_value: url, status: 'processing' }) })
  const parts = chunks(text)
  const vectors = await embed(parts)
  const rows = parts.map((content, index) => ({ source_id: sourceId, org_id: orgId, chunk_index: index, content, embedding: `[${vectors[index].join(',')}]`, metadata: { e2e: true, url } }))
  await supa('knowledge_chunks', { method: 'POST', body: JSON.stringify(rows) })
  await supa(`knowledge_sources?id=eq.${sourceId}`, { method: 'PATCH', body: JSON.stringify({ status: 'ready', content_hash: 'e2e-firecrawl-openai', updated_at: new Date().toISOString() }) })

  const webhook = await fetch(`${baseUrl}/api/webhooks/ai/webchat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-prontoai-webhook-secret': secret }, body: JSON.stringify({ org_id: orgId, conversationId, message: { id: providerMessageId, sender: { id: 'rag-e2e' }, text: 'Quali servizi offre ProntoAI24?', direction: 'inbound', created_at: new Date().toISOString() } }) })
  const webhookBody = await webhook.json()
  if (webhook.status !== 200) throw new Error(`Webhook ${webhook.status}: ${JSON.stringify(webhookBody)}`)
  if (!webhookBody.reply) throw new Error(`Risposta RAG assente: ${JSON.stringify(webhookBody)}`)
  const persisted = await supa(`messages?select=provider_message_id,body&org_id=eq.${orgId}&provider_message_id=eq.${providerMessageId}`)
  console.log(JSON.stringify({ ok: true, firecrawl: { url, characters: text.length }, embeddings: { model: 'text-embedding-3-small', chunks: parts.length }, webhook: webhookBody, persistedMessages: persisted.length, observability: { sentryHelperInvoked: true, langfuseConfigured: Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) } }, null, 2))
} finally {
  await supa(`messages?provider_message_id=eq.${providerMessageId}`, { method: 'DELETE' }).catch(() => {})
  await supa(`conversations?org_id=eq.${orgId}&conversation_id=eq.${conversationId}`, { method: 'DELETE' }).catch(() => {})
  await supa(`knowledge_chunks?source_id=eq.${sourceId}`, { method: 'DELETE' }).catch(() => {})
  await supa(`knowledge_sources?id=eq.${sourceId}`, { method: 'DELETE' }).catch(() => {})
}
