import { withSentryConfig } from '@sentry/nextjs'

const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default withSentryConfig(nextConfig, {
  org: 'web-mindset-agency-srla',
  project: 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
