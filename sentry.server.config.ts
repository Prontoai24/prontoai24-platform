import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  beforeSend(event) {
    event.tags = { ...event.tags, org_id: event.tags?.org_id || 'default' }
    return event
  },
})
