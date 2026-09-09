import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && challenge && token === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge, { status: 200 })
  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 })
}

export async function POST(request: Request) {
  const target = new URL('/api/webhooks/ai/whatsapp', request.url)
  return fetch(target, { method: 'POST', headers: request.headers, body: await request.arrayBuffer() })
}
