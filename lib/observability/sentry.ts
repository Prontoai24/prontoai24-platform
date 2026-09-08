import * as Sentry from '@sentry/nextjs'

export function normalizeOrgId(orgId?: string | null) {
  return orgId?.trim() || 'default'
}

export function captureObservedException(error: unknown, orgId?: string | null, context?: Record<string, unknown>) {
  const normalizedOrgId = normalizeOrgId(orgId)
  Sentry.withScope((scope) => {
    scope.setTag('org_id', normalizedOrgId)
    if (context) scope.setContext('observability', context)
    Sentry.captureException(error)
  })
}

export function captureObservedMessage(message: string, level: Sentry.SeverityLevel = 'error', orgId?: string | null, context?: Record<string, unknown>) {
  const normalizedOrgId = normalizeOrgId(orgId)
  Sentry.withScope((scope) => {
    scope.setTag('org_id', normalizedOrgId)
    if (context) scope.setContext('observability', context)
    Sentry.captureMessage(message, level)
  })
}
