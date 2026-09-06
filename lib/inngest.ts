import { Inngest } from 'inngest'

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
