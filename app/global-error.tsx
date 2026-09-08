'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.withScope((scope) => {
      scope.setTag('org_id', 'default')
      Sentry.captureException(error)
    })
  }, [error])

  return <html><body><main style={{ fontFamily: 'system-ui', padding: 32 }}><h1>Si è verificato un errore</h1><p>Ricarica la pagina e riprova.</p></main></body></html>
}
