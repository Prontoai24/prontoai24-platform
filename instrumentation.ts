export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      const { LangfuseSpanProcessor } = await import('@langfuse/otel')
      const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node')
      new NodeTracerProvider({ spanProcessors: [new LangfuseSpanProcessor()] }).register()
    }
  }
}
