import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe non configurato' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Firma Stripe mancante' }, { status: 400 })
  }

  const stripe = new Stripe(secretKey)
  const payload = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Firma Stripe non valida' }, { status: 400 })
  }

  await inngest.send({
    name: 'stripe/webhook.received',
    data: {
      eventId: event.id,
      eventType: event.type,
      payload: event.data.object,
    },
  })

  return NextResponse.json({ received: true, eventId: event.id })
}
