import { Inngest } from 'inngest'
import { createClient } from '@supabase/supabase-js'

export const inngest = new Inngest({ id: 'prontoai24-platform' })

export const processStripeWebhook = inngest.createFunction(
  { id: 'process-stripe-webhook', name: 'Process Stripe webhook event' },
  { event: 'stripe/webhook.received' },
  async ({ event, step }) => {
    return step.run('record-event', async () => ({
      received: true,
      eventId: event.data.eventId,
      eventType: event.data.eventType,
    }))
  }
)

export const syncUsage = inngest.createFunction(
  { id: 'sync-client-usage', name: 'Sync client usage' },
  { event: 'usage/sync.requested' },
  async ({ event, step }) => {
    const { clientId, minutesUsed } = event.data as { clientId: string; minutesUsed: number }
    return step.run('update-subscription-usage', async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data: subscription, error: readError } = await supabase.from('subscriptions').select('id, minutes_used_current_period').eq('client_id', clientId).eq('status', 'active').single()
      if (readError || !subscription) throw readError || new Error('Active subscription not found')
      const total = Number(subscription.minutes_used_current_period) + Number(minutesUsed)
      const { error } = await supabase.from('subscriptions').update({ minutes_used_current_period: total, updated_at: new Date().toISOString() }).eq('id', subscription.id)
      if (error) throw error
      return { clientId, subscriptionId: subscription.id, minutesUsed: total }
    })
  }
)
