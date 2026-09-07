import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function canManage() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return false; const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single(); return data?.role === 'admin' || data?.role === 'super_admin' }
async function vapi(path: string, init: RequestInit = {}) { const key = process.env.VAPI_API_KEY; if (!key) return NextResponse.json({ error: 'VAPI_API_KEY non configurata' }, { status: 503 }); const response = await fetch(`https://api.vapi.ai${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) } }); const body = await response.json(); return NextResponse.json(body, { status: response.status }) }

export async function POST(request: Request) { if (!(await canManage())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 }); const { phoneNumberId, assistantId } = await request.json(); if (!phoneNumberId || !assistantId) return NextResponse.json({ error: 'phoneNumberId e assistantId sono obbligatori' }, { status: 400 }); return vapi(`/phone-number/${encodeURIComponent(phoneNumberId)}`, { method: 'PATCH', body: JSON.stringify({ assistantId }) }) }
export async function PUT(request: Request) { if (!(await canManage())) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 }); const body = await request.json(); return vapi('/phone-number', { method: 'POST', body: JSON.stringify(body) }) }
