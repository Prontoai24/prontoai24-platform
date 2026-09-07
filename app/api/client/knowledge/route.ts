import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', user.id).single(); if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
  const form = await request.formData(); const file = form.get('file'); if (!(file instanceof File)) return NextResponse.json({ error: 'File mancante' }, { status: 400 }); if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Il file supera il limite di 10 MB' }, { status: 413 })
  const admin = createAdminClient(); const bucket = 'knowledge-base'; const { data: bucketInfo } = await admin.storage.getBucket(bucket); if (!bucketInfo) { const { error } = await admin.storage.createBucket(bucket, { public: false }); if (error && !error.message.toLowerCase().includes('already exists')) return NextResponse.json({ error: error.message }, { status: 500 }) }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${client.id}/${crypto.randomUUID()}-${safeName}`; const upload = await admin.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream', upsert: false }); if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 })
  const { data: document, error } = await admin.from('knowledge_documents').insert({ client_id: client.id, uploaded_by: user.id, file_name: file.name, storage_path: path, mime_type: file.type || null, status: 'queued' }).select('*').single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ document }, { status: 201 })
}
