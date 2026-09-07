import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>
const tiers = ['base', 'evoluto', 'enterprise'] as const
const minutes = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]
const MAX_FILE_SIZE = 10 * 1024 * 1024

type PricingRow = {
  plan_type: (typeof tiers)[number]
  included_minutes: number
  billing_cycle: 'trimestrale' | 'annuale'
  price_cents: number
  active: boolean
  created_by: string
  updated_at: string
}

function parsePricingRows(text: string, userId: string): PricingRow[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const billingCycle: PricingRow['billing_cycle'] = /annuale|annual|yearly/i.test(normalized) ? 'annuale' : 'trimestrale'
  const money = /(?:€|EUR)?\s*(\d{1,5}(?:[.,]\d{1,2})?)/g
  const rows: PricingRow[] = []

  for (const tier of tiers) {
    const tierPosition = normalized.toLowerCase().indexOf(tier)
    const tierWindow = tierPosition >= 0 ? normalized.slice(tierPosition, tierPosition + 1500) : normalized

    for (const includedMinutes of minutes) {
      const minutePosition = tierWindow.indexOf(String(includedMinutes))
      if (minutePosition < 0) continue

      const candidate = tierWindow.slice(minutePosition + String(includedMinutes).length, minutePosition + 220)
      const values: number[] = []
      let match: RegExpExecArray | null
      while ((match = money.exec(candidate)) !== null) {
        const value = Number(match[1].replace(',', '.'))
        if (value > 0 && value < 1_000_000) values.push(value)
      }
      money.lastIndex = 0
      const price = values[0]
      if (price === undefined) continue

      rows.push({
        plan_type: tier,
        included_minutes: includedMinutes,
        billing_cycle: billingCycle,
        price_cents: Math.round(price * 100),
        active: true,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
    }
  }

  return rows
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Solo il Super Admin può importare il listino' }, { status: 403 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Carica un file PDF valido' }, { status: 400 })
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Carica un file PDF valido' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Il PDF supera il limite di 10 MB' }, { status: 413 })

    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()))
    const rows = parsePricingRows(parsed.text || '', user.id)
    if (!rows.length) return NextResponse.json({ error: 'Nessuna riga riconoscibile. Usa un PDF testuale con piano, minuti e prezzo.' }, { status: 422 })

    const admin = createAdminClient()
    const { data, error } = await admin.from('pricing_catalog').upsert(rows, { onConflict: 'plan_type,included_minutes,billing_cycle' }).select('*')
    if (error) return NextResponse.json({ error: `Salvataggio listino non riuscito: ${error.message}` }, { status: 400 })

    return NextResponse.json({ imported: data?.length || 0, rows: data || [] })
  } catch (error) {
    console.error('Pricing PDF import failed', error)
    return NextResponse.json({ error: 'Importazione PDF non riuscita. Verifica che il file sia leggibile.' }, { status: 500 })
  }
}
