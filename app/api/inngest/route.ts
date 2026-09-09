import { serve } from 'inngest/next'
import { checkUsageLimits, inngest, processKnowledgeIngestion, processStripeWebhook, sendWhatsAppMessage, syncUsage, trackVoiceCallUsage, trackWhatsAppUsage } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStripeWebhook, syncUsage, processKnowledgeIngestion, trackVoiceCallUsage, trackWhatsAppUsage, sendWhatsAppMessage, checkUsageLimits],
})
