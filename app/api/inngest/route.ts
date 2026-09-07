import { serve } from 'inngest/next'
import { inngest, processStripeWebhook, syncUsage } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStripeWebhook, syncUsage],
})
