import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const target = new URL('/api/webhooks/ai/vapi', request.url)
  const body = await request.arrayBuffer()
  return fetch(target, { method: 'POST', headers: request.headers, body })
}
