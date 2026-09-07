import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>
const tiers = ['base', 'evoluto', 'enterprise']
const minutes = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]

export async function POST(request: Request) {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Solo il Super Admin può importare il listino' }, { status: 403 })
  const form = await request.formData(); const file = form.get('file')
  if (!(file instanceof File) || file.type !== 'application/pdf') return NextResponse.json({ error: 'Carica un file PDF valido' }, { status: 400 })
  const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()))
  const text = parsed.text.replace(/\s+/g, ' ')
  const rows: Array<{ planType: string; includedMinutes: number; billingCycle: string; priceCents: number }> = []
  const money = /(?:€|EUR)?\s*(\d{1,5}(?:[.,]\d{1,2})?)/g
  for (const tier of tiers) for (const mins of minutes) {
    const position = text.toLowerCase().indexOf(tier)
    const window = position >= 0 ? text.slice(position, position + 1000) : text
    const minutePosition = window.indexOf(String(mins)); const candidate = minutePosition >= 0 ? window.slice(minutePosition, minutePosition + 180) : ''
    const matches: number[] = []
    let match: RegExpExecArray | null
    while ((match = money.exec(candidate)) !== null) matches.push(Number(match[1].replace(',', '.')))
    const validMatches = matches.filter((value) => value > 0)
    if (validMatches.length) { rows.push({ planType: tier, includedMinutes: mins, billingCycle: text.toLowerCase().includes('annuale') ? 'annuale' : 'trimestrale', priceCents: Math.round(validMatches[0] * 100) }) }
  }
  if (!rows.length) return NextResponse.json({ error: 'Nessuna riga riconoscibile. Usa un PDF testuale con piano, minuti e prezzo.' }, { status: 422 })
  const admin = createAdminClient(); const { data, error } = await admin.from('pricing_catalog').upsert(rows.map((row) => ({ ...row, plan_type: row.planType, included_minutes: row.includedMinutes, billing_cycle: row.billingCycle, price_cents: row.priceCents, created_by: user.id })).map(({ planType, includedMinutes, billingCycle, priceCents, ...row }) => row), { onConflict: 'plan_type,included_minutes,billing_cycle' }).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ imported: data?.length || 0, rows: data })
}
