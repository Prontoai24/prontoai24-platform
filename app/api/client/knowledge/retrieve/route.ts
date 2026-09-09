import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKnowledgePrompt } from '@/lib/knowledge/rag'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
  const payload = await request.json() as { query?: string; basePrompt?: string }
  if (!payload.query?.trim()) return NextResponse.json({ error: 'Query mancante' }, { status: 400 })
  const prompt = await buildKnowledgePrompt(client.id, payload.query, payload.basePrompt || '')
  return NextResponse.json({ prompt, org_id: client.id })
}
