import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateImpersonationLink } from '@/lib/admin-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Solo il Super Admin può impersonare un tenant' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { clientId?: string }
  if (!body.clientId) return NextResponse.json({ error: 'clientId obbligatorio' }, { status: 400 })
  try {
    const actionLink = await generateImpersonationLink(body.clientId)
    return NextResponse.json({ actionLink })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Errore impersonation' }, { status: 400 })
  }
}
