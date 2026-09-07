import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function guard() {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single(); if (profile?.role !== 'super_admin') return { error: NextResponse.json({ error: 'Solo il Super Admin può gestire i listini' }, { status: 403 }) }; return { user }
}

export async function GET() { const supabase = createClient(); const { data: plans, error } = await supabase.from('pricing_plans').select('*').order('tier').order('minutes_package'); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ plans }) }
export async function POST(request: Request) { const auth = await guard(); if (auth.error) return auth.error; const body = await request.json(); const { name, tier, minutesPackage, basePriceCents, whatsappAddonPriceCents = 0, chatbotAddonPriceCents = 0, active = true } = body; if (!name || !tier || !minutesPackage || basePriceCents === undefined) return NextResponse.json({ error: 'Campi listino mancanti' }, { status: 400 }); const admin = createAdminClient(); const { data: plan, error } = await admin.from('pricing_plans').insert({ name, tier, minutes_package: minutesPackage, base_price_cents: basePriceCents, whatsapp_addon_price_cents: whatsappAddonPriceCents, chatbot_addon_price_cents: chatbotAddonPriceCents, active }).select('*').single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); await admin.from('audit_logs').insert({ actor_id: auth.user.id, action: 'pricing_plan.created', entity_type: 'pricing_plan', entity_id: plan.id, metadata: { name, tier } }); return NextResponse.json({ plan }, { status: 201 }) }
