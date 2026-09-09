import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const env = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} mancante`); return value }
const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const unstructuredUrl = env('UNSTRUCTURED_API_URL')
const unstructuredKey = env('UNSTRUCTURED_API_KEY')
const openaiKey = env('OPENAI_API_KEY')
const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const report: Record<string, unknown> = { config: { unstructuredUrl: new URL(unstructuredUrl).origin, apiKeyPresent: true, embeddingModel } }
const id = crypto.randomUUID()
const email = `qa-ingestion-${id}@example.invalid`
const password = `Qa!${id}a1`
const mdPath = `/tmp/${id}.md`
const pdfPath = `/tmp/${id}.pdf`
let userId: string | undefined
let clientId: string | undefined
let sourceId: string | undefined

async function main() {
try {
  await fs.writeFile(mdPath, `# ProntoAI24 QA E2E\n\nQuesto PDF verifica parsing Unstructured, embedding OpenAI e deduplicazione content_hash.\n\nFixture ${id}.`)
  execFileSync('manus-md-to-pdf', [mdPath, pdfPath], { stdio: 'ignore' })
  const pdf = await fs.readFile(pdfPath)
  const hash = crypto.createHash('sha256').update(pdf).digest('hex')
  report.pdf = { bytes: pdf.length, sha256: hash }

  const form = new FormData()
  form.append('files', new Blob([pdf], { type: 'application/pdf' }), 'qa-fixture.pdf')
  const apiBase = unstructuredUrl.replace(/\/+$/, '').endsWith('/api/v1') ? unstructuredUrl.replace(/\/+$/, '') : `${unstructuredUrl.replace(/\/+$/, '')}/api/v1`
  form.delete('files')
  form.append('request_data', JSON.stringify({ job_nodes: [{ name: 'Partitioner', type: 'partition', subtype: 'vlm', settings: { is_dynamic: true, allow_fast: true } }] }))
  form.append('input_files', new Blob([pdf], { type: 'application/pdf' }), 'qa-fixture.pdf')
  const parsing = await fetch(`${apiBase}/jobs/`, { method: 'POST', headers: { accept: 'application/json', 'unstructured-api-key': unstructuredKey }, body: form })
  const parsingText = await parsing.text()
  if (!parsing.ok) throw new Error(`Unstructured HTTP ${parsing.status}: ${parsingText.slice(0, 300)}`)
  const jobCreated = JSON.parse(parsingText) as { id?: string; job_information?: { id?: string } }
  const jobId = jobCreated.id || jobCreated.job_information?.id
  if (!jobId) throw new Error('Unstructured job id mancante')
  let job: { status?: string; output_node_files?: Array<{ file_id?: string }> } = {}
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const statusResponse = await fetch(`${apiBase}/jobs/${jobId}`, { headers: { accept: 'application/json', 'unstructured-api-key': unstructuredKey } })
    if (!statusResponse.ok) throw new Error(`Unstructured status HTTP ${statusResponse.status}`)
    job = await statusResponse.json() as typeof job
    if (job.status === 'COMPLETED') break
    if (job.status === 'FAILED' || job.status === 'STOPPED') throw new Error(`Unstructured job ${job.status}`)
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (job.status !== 'COMPLETED') throw new Error('Timeout Unstructured job')
  const elements: Array<{ text?: string }> = []
  for (const outputFile of job.output_node_files || []) {
    if (!outputFile.file_id) continue
    const outputResponse = await fetch(`${apiBase}/jobs/${jobId}/download?file_id=${encodeURIComponent(outputFile.file_id)}`, { headers: { 'unstructured-api-key': unstructuredKey } })
    if (!outputResponse.ok) throw new Error(`Unstructured output HTTP ${outputResponse.status}`)
    const output = await outputResponse.json() as Array<{ text?: string }> | { elements?: Array<{ text?: string }> }
    elements.push(...(Array.isArray(output) ? output : output.elements || []))
  }
  const extractedText = elements.map((element) => element.text || '').filter(Boolean).join('\n').trim()
  if (!extractedText) throw new Error('Unstructured non ha restituito testo')
  report.unstructured = { ok: true, elements: elements.length, extractedChars: extractedText.length, endpointPath: '/api/v1/jobs/' }

  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: embeddingModel, input: [extractedText] }) })
  const embeddingPayload = await embeddingResponse.json() as { data?: Array<{ embedding: number[] }>; error?: { message?: string } }
  if (!embeddingResponse.ok || !embeddingPayload.data?.[0]?.embedding) throw new Error(`OpenAI embeddings HTTP ${embeddingResponse.status}: ${embeddingPayload.error?.message || 'embedding mancante'}`)
  const embedding = embeddingPayload.data[0].embedding
  report.embedding = { ok: true, dimensions: embedding.length }

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { must_change_password: false } })
  if (created.error || !created.data.user) throw created.error || new Error('Utente fixture non creato')
  userId = created.data.user.id
  const profile = await admin.from('profiles').insert({ id: userId, role: 'client', email, full_name: 'QA Ingestion Fixture', must_change_password: false })
  if (profile.error) throw profile.error
  const tenant = await admin.from('clients').insert({ profile_id: userId, managed_by_admin: userId, contact_email: email, company_name: 'QA Fixture', status: 'active' }).select('id').single()
  if (tenant.error || !tenant.data) throw tenant.error || new Error('Tenant fixture non creato')
  clientId = tenant.data.id

  const source = await admin.from('knowledge_sources').insert({ org_id: clientId, type: 'file', source_value: `qa/${id}.pdf`, status: 'processing', content_hash: hash }).select('id').single()
  if (source.error || !source.data) throw source.error || new Error('Fonte fixture non creata')
  sourceId = source.data.id
  const chunk = await admin.from('knowledge_chunks').insert({ source_id: sourceId, org_id: clientId, chunk_index: 0, content: extractedText, embedding: `[${embedding.join(',')}]`, metadata: { qa: true } })
  if (chunk.error) throw chunk.error
  const ready = await admin.from('knowledge_sources').update({ status: 'ready', error_message: null }).eq('id', sourceId)
  if (ready.error) throw ready.error
  const duplicate = await admin.from('knowledge_sources').select('id').eq('org_id', clientId).eq('content_hash', hash).eq('status', 'ready').maybeSingle()
  report.deduplication = { ok: !duplicate.error && Boolean(duplicate.data), existingSourceId: duplicate.data?.id || null }

  const serviceRpc = await admin.rpc('match_knowledge_chunks', { query_embedding: `[${embedding.join(',')}]`, match_org_id: clientId, match_threshold: 0, match_count: 1 })
  report.rpcServiceRole = { ok: !serviceRpc.error, rows: serviceRpc.data?.length || 0, errorCode: serviceRpc.error?.code || null, errorMessage: serviceRpc.error?.message || null }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const signIn = await authClient.auth.signInWithPassword({ email, password })
  if (signIn.error || !signIn.data.session) throw signIn.error || new Error('Login fixture fallito')
  const foreignOrg = crypto.randomUUID()
  const authRpc = await authClient.rpc('match_knowledge_chunks', { query_embedding: `[${embedding.join(',')}]`, match_org_id: foreignOrg, match_threshold: 0, match_count: 1 })
  report.rpcAuthenticatedForeignOrg = { denied: Boolean(authRpc.error), errorCode: authRpc.error?.code || null, errorMessage: authRpc.error?.message || null, expected: '42501' }
  report.rpcSecurityNote = authRpc.error?.code === '42501' ? (authRpc.error.message?.includes('permission denied') ? 'EXECUTE revocato a authenticated: deniale a livello grant, non messaggio custom della funzione' : 'denial proveniente dalla funzione/RLS') : 'nessun 42501 ricevuto'

  console.log(JSON.stringify(report, null, 2))
} finally {
  if (sourceId) { await admin.from('knowledge_chunks').delete().eq('source_id', sourceId); await admin.from('knowledge_sources').delete().eq('id', sourceId) }
  if (clientId) await admin.from('clients').delete().eq('id', clientId)
  if (userId) await admin.from('profiles').delete().eq('id', userId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  await fs.rm(mdPath, { force: true }); await fs.rm(pdfPath, { force: true })
}

}

main().catch((error) => { console.error(error); process.exitCode = 1 })
