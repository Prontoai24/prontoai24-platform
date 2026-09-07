import { Inngest } from 'inngest'
import { createClient } from '@supabase/supabase-js'

export const inngest = new Inngest({ id: 'prontoai24-platform' })

function adminDb() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }) }

export const processStripeWebhook = inngest.createFunction(
  { id: 'process-stripe-webhook', name: 'Process Stripe webhook event' },
  { event: 'stripe/webhook.received' },
  async ({ event, step }) => step.run('synchronize-stripe-state', async () => {
    const db = adminDb(); const data: any = event.data; const object: any = data.payload || {}; const type = data.eventType as string
    const customerId = object.customer || object.customer_details?.id || null
    let client: any = null
    if (customerId) { const result = await db.from('clients').select('id').eq('stripe_customer_id', customerId).single(); client = result.data }
    if (type === 'checkout.session.completed' && object.customer && object.subscription && client) await db.from('subscriptions').update({ stripe_subscription_id: object.subscription, status: 'active', activation_paid: true, updated_at: new Date().toISOString() }).eq('client_id', client.id)
    if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const status = type.endsWith('deleted') ? 'expired' : (object.status === 'active' ? 'active' : 'suspended')
      await db.from('subscriptions').update({ status, current_period_start: object.current_period_start ? new Date(object.current_period_start * 1000).toISOString() : undefined, current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : undefined, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', object.id)
    }
    if (type === 'invoice.paid' || type === 'invoice.payment_failed' || type === 'invoice.finalized') {
      if (client) await db.from('invoices').upsert({ client_id: client.id, stripe_invoice_id: object.id, amount_cents: object.amount_paid || object.amount_due || 0, currency: object.currency || 'eur', status: type === 'invoice.paid' ? 'paid' : (object.status || 'open'), hosted_invoice_url: object.hosted_invoice_url, invoice_pdf_url: object.invoice_pdf, issued_at: object.created ? new Date(object.created * 1000).toISOString() : new Date().toISOString(), paid_at: type === 'invoice.paid' ? new Date().toISOString() : null }, { onConflict: 'stripe_invoice_id' })
    }
    await db.from('audit_logs').insert({ action: `stripe.${type}`, entity_type: 'stripe_event', metadata: { eventId: data.eventId, clientId: client?.id || null } })
    return { received: true, eventId: data.eventId, eventType: type, clientId: client?.id || null }
  })
)

export const syncUsage = inngest.createFunction(
  { id: 'sync-client-usage', name: 'Sync client usage' },
  { event: 'usage/sync.requested' },
  async ({ event, step }) => step.run('update-subscription-usage', async () => {
    const { clientId, minutesUsed } = event.data as { clientId: string; minutesUsed: number }; const db = adminDb(); const { data: subscription, error: readError } = await db.from('subscriptions').select('id, minutes_used_current_period').eq('client_id', clientId).eq('status', 'active').single(); if (readError || !subscription) throw readError || new Error('Active subscription not found'); const total = Number(subscription.minutes_used_current_period) + Number(minutesUsed); const { error } = await db.from('subscriptions').update({ minutes_used_current_period: total, updated_at: new Date().toISOString() }).eq('id', subscription.id); if (error) throw error; return { clientId, subscriptionId: subscription.id, minutesUsed: total }
  })
)
