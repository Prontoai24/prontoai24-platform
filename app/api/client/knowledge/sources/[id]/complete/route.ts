import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest'
import { assertKnowledgeObjectExists } from '@/lib/storage/r2'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })

  const admin = createAdminClient()
  const { data: source, error } = await admin.from('knowledge_sources').select('id,org_id,type,source_value,status,content_hash').eq('id', context.params.id).eq('org_id', client.id).single()
  if (error || !source) return NextResponse.json({ error: 'Fonte non trovata' }, { status: 404 })
  if (source.type !== 'file') return NextResponse.json({ error: 'La fonte non è un file' }, { status: 400 })
  if (source.status !== 'pending') return NextResponse.json({ source, queued: source.status === 'processing' }, { status: 200 })

  try {
    await assertKnowledgeObjectExists(source.source_value)
    const body = await request.json().catch(() => ({})) as { fileName?: string; mimeType?: string }
    await inngest.send({
      name: 'knowledge/source.created',
      data: {
        sourceId: source.id,
        orgId: source.org_id,
        type: 'file',
        sourceValue: source.source_value,
        fileName: body.fileName,
        mimeType: body.mimeType,
        contentHash: source.content_hash,
      },
    })
    await admin.from('knowledge_sources').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', source.id).eq('org_id', client.id)
    return NextResponse.json({ source: { ...source, status: 'processing' }, queued: true }, { status: 202 })
  } catch (dispatchError) {
    const message = dispatchError instanceof Error ? dispatchError.message.slice(0, 1000) : 'Avvio elaborazione fallito'
    await admin.from('knowledge_sources').update({ status: 'error', error_message: message, updated_at: new Date().toISOString() }).eq('id', source.id).eq('org_id', client.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
