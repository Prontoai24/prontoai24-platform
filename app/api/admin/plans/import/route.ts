import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (data: Buffer) => Promise<{ text: string }>
const tiers = ['base', 'evoluto', 'enterprise'] as const
const minutes = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]
const billingCycles = ['trimestrale', 'annuale'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024

type BillingCycle = (typeof billingCycles)[number]
type PreviewRow = { planType: (typeof tiers)[number]; includedMinutes: number; billingCycle: BillingCycle; priceCents: number }
type PricingRow = PreviewRow & { active: boolean; createdBy: string; updatedAt: string }

function parsePricingRows(text: string): PreviewRow[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const billingCycle: BillingCycle = /annuale|annual|yearly/i.test(normalized) ? 'annuale' : 'trimestrale'
  const money = /(?:€|EUR)?\s*(\d{1,5}(?:[.,]\d{1,2})?)/g
  const rows: PreviewRow[] = []

  for (const planType of tiers) {
    const tierPosition = normalized.toLowerCase().indexOf(planType)
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
      if (values[0] !== undefined) rows.push({ planType, includedMinutes, billingCycle, priceCents: Math.round(values[0] * 100) })
    }
  }
  return rows
}

function validateRows(value: unknown): PreviewRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > tiers.length * minutes.length * billingCycles.length) return null
  const rows: PreviewRow[] = []
  const keys = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const planType = row.planType
    const includedMinutes = Number(row.includedMinutes)
    const billingCycle = row.billingCycle
    const priceCents = Number(row.priceCents)
    if (!tiers.includes(planType as (typeof tiers)[number]) || !minutes.includes(includedMinutes) || !billingCycles.includes(billingCycle as BillingCycle) || !Number.isInteger(priceCents) || priceCents < 0) return null
    const key = `${planType}:${includedMinutes}:${billingCycle}`
    if (keys.has(key)) return null
    keys.add(key)
    rows.push({ planType: planType as (typeof tiers)[number], includedMinutes, billingCycle: billingCycle as BillingCycle, priceCents })
  }
  return rows
}

async function getSuperAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return { error: NextResponse.json({ error: 'Solo il Super Admin può gestire il listino' }, { status: 403 }) }
  return { user }
}

export async function POST(request: Request) {
  try {
    const auth = await getSuperAdmin()
    if (auth.error) return auth.error

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null)
      const rows = validateRows(body?.rows)
      if (!rows) return NextResponse.json({ error: 'Righe di listino non valide o duplicate' }, { status: 400 })
      const now = new Date().toISOString()
      const records: PricingRow[] = rows.map((row) => ({ ...row, active: true, createdBy: auth.user.id, updatedAt: now }))
      const admin = createAdminClient()
      const { data, error } = await admin.from('pricing_catalog').upsert(records.map(({ planType, includedMinutes, billingCycle, priceCents, active, createdBy, updatedAt }) => ({ plan_type: planType, included_minutes: includedMinutes, billing_cycle: billingCycle, price_cents: priceCents, active, created_by: createdBy, updated_at: updatedAt })), { onConflict: 'plan_type,included_minutes,billing_cycle' }).select('*')
      if (error) return NextResponse.json({ error: `Pubblicazione listino non riuscita: ${error.message}` }, { status: 400 })
      return NextResponse.json({ confirmed: true, imported: data?.length || 0, rows: data || [] })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Carica un file PDF valido' }, { status: 400 })
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'Carica un file PDF valido' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Il PDF supera il limite di 10 MB' }, { status: 413 })

    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()))
    const rows = parsePricingRows(parsed.text || '')
    if (!rows.length) return NextResponse.json({ error: 'Nessuna riga riconoscibile. Usa un PDF testuale con piano, minuti e prezzo.' }, { status: 422 })
    return NextResponse.json({ preview: true, rows })
  } catch (error) {
    console.error('Pricing PDF import failed', error)
    return NextResponse.json({ error: 'Importazione PDF non riuscita. Verifica che il file sia leggibile.' }, { status: 500 })
  }
}
