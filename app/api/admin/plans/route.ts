import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const MINUTES = [150, 300, 500, 1000, 2000, 4000, 7000, 10000]

async function guard() {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return { error: NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 }) }
  return { user, role: profile.role }
}

export async function GET() {
  const supabase = createClient()
  const { data: catalog, error } = await supabase.from('pricing_catalog').select('*').eq('active', true).order('plan_type').order('included_minutes').order('billing_cycle')
  if (!error) return NextResponse.json({ catalog, plans: catalog.map((item) => ({ ...item, tier: item.plan_type, minutes_package: item.included_minutes, base_price_cents: item.price_cents, billing_cycle: item.billing_cycle })) })
  const { data: plans, error: fallbackError } = await supabase.from('pricing_plans').select('*').eq('active', true).order('tier').order('minutes_package')
  if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 400 })
  return NextResponse.json({ plans: plans || [], catalog: [] })
}

export async function POST(request: Request) {
  const auth = await guard(); if (auth.error) return auth.error
  const body = await request.json(); const admin = createAdminClient()
  if (body.planType && body.billingCycle) {
    const { planType, includedMinutes, billingCycle, priceCents, active = true } = body
    if (!['base', 'evoluto', 'enterprise'].includes(planType) || !MINUTES.includes(Number(includedMinutes)) || !['trimestrale', 'annuale'].includes(billingCycle) || Number(priceCents) < 0) return NextResponse.json({ error: 'Dati listino non validi' }, { status: 400 })
    const { data: item, error } = await admin.from('pricing_catalog').upsert({ plan_type: planType, included_minutes: Number(includedMinutes), billing_cycle: billingCycle, price_cents: Number(priceCents), active, created_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: 'plan_type,included_minutes,billing_cycle' }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ catalog: item }, { status: 201 })
  }
  const { name, tier, minutesPackage, basePriceCents, whatsappAddonPriceCents = 0, chatbotAddonPriceCents = 0, active = true } = body
  if (!name || !tier || !minutesPackage || basePriceCents === undefined) return NextResponse.json({ error: 'Campi listino mancanti' }, { status: 400 })
  const { data: plan, error } = await admin.from('pricing_plans').insert({ name, tier, minutes_package: minutesPackage, base_price_cents: basePriceCents, whatsapp_addon_price_cents: whatsappAddonPriceCents, chatbot_addon_price_cents: chatbotAddonPriceCents, active }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ plan }, { status: 201 })
}
