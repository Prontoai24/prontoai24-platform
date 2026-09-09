import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe non configurato' }, { status: 503 })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
    if (!client?.stripe_customer_id) return NextResponse.json({ error: 'Nessun account Stripe associato all’organizzazione.' }, { status: 400 })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const domainUrl = process.env.NEXT_PUBLIC_CLIENT_APP_URL || 'https://client.prontoai24.it'
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: `${domainUrl}/client/impostazioni/fatturazione`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[billing/portal]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Errore Stripe' }, { status: 500 })
  }
}
