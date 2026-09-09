import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days') || 30)))
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const admin = createAdminClient()
  let query = admin.from('ai_usage_events').select('org_id,channel,provider,model,input_tokens,output_tokens,total_tokens,latency_ms,cost_usd,status,created_at').gte('created_at', since).order('created_at', { ascending: true })
  if (profile.role === 'admin') {
    const { data: managed } = await admin.from('clients').select('id').eq('managed_by_admin', user.id)
    query = query.in('org_id', (managed || []).map((client: { id: string }) => client.id))
  }
  const { data: events, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = events || []
  const byChannel = Object.values(rows.reduce((acc: Record<string, any>, row: any) => {
    const key = row.channel || 'other'; acc[key] ||= { channel: key, conversations: 0, tokens: 0, costUsd: 0, latencyTotal: 0, errors: 0 }
    acc[key].conversations += 1; acc[key].tokens += Number(row.total_tokens || 0); acc[key].costUsd += Number(row.cost_usd || 0); acc[key].latencyTotal += Number(row.latency_ms || 0); acc[key].errors += row.status === 'error' ? 1 : 0; return acc
  }, {})).map((item: any) => ({ ...item, avgLatencyMs: item.conversations ? Math.round(item.latencyTotal / item.conversations) : 0 }))
  const byTenant = Object.values(rows.reduce((acc: Record<string, any>, row: any) => {
    const key = row.org_id; acc[key] ||= { orgId: key, conversations: 0, tokens: 0, costUsd: 0, latencyTotal: 0, errors: 0 }
    acc[key].conversations += 1; acc[key].tokens += Number(row.total_tokens || 0); acc[key].costUsd += Number(row.cost_usd || 0); acc[key].latencyTotal += Number(row.latency_ms || 0); acc[key].errors += row.status === 'error' ? 1 : 0; return acc
  }, {})).map((item: any) => ({ ...item, avgLatencyMs: item.conversations ? Math.round(item.latencyTotal / item.conversations) : 0 }))
  const daily = Object.values(rows.reduce((acc: Record<string, any>, row: any) => {
    const key = row.created_at.slice(0, 10); acc[key] ||= { date: key, conversations: 0, tokens: 0, costUsd: 0 }
    acc[key].conversations += 1; acc[key].tokens += Number(row.total_tokens || 0); acc[key].costUsd += Number(row.cost_usd || 0); return acc
  }, {})).sort((a: any, b: any) => a.date.localeCompare(b.date))
  return NextResponse.json({ range: { days, since }, totals: { conversations: rows.length, tokens: rows.reduce((sum: number, row: any) => sum + Number(row.total_tokens || 0), 0), costUsd: rows.reduce((sum: number, row: any) => sum + Number(row.cost_usd || 0), 0), avgLatencyMs: rows.length ? Math.round(rows.reduce((sum: number, row: any) => sum + Number(row.latency_ms || 0), 0) / rows.length) : 0, errors: rows.filter((row: any) => row.status === 'error').length }, byChannel, byTenant, daily })
}
