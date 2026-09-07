import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sessione non valida o scaduta. Effettua nuovamente il login.' }, { status: 401 })

  const adminClient = createAdminClient()
  const { error: profileError } = await adminClient.from('profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (profileError) return NextResponse.json({ error: `Password aggiornata, ma il profilo non è stato completato: ${profileError.message}` }, { status: 500 })

  const metadata = { ...(user.user_metadata || {}), must_change_password: false, force_password_change: false }
  const { error: metadataError } = await adminClient.auth.admin.updateUserById(user.id, { user_metadata: metadata })
  if (metadataError) return NextResponse.json({ error: `Profilo aggiornato, ma i metadati non sono stati sincronizzati: ${metadataError.message}` }, { status: 500 })

  return NextResponse.json({ success: true })
}
