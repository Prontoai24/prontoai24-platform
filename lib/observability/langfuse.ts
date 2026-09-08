import OpenAI from 'openai'
import { observeOpenAI } from '@langfuse/openai'
import { Langfuse } from 'langfuse'

export type ObservabilityContext = {
  orgId?: string | null
  userId?: string | null
  sessionId?: string | null
  feature?: string
}

const defaultOrgId = () => process.env.OBSERVABILITY_DEFAULT_ORG_ID || 'default'

export function getOrgId(orgId?: string | null) {
  return orgId?.trim() || defaultOrgId()
}

export function createObservedOpenAI(context: ObservabilityContext = {}) {
  const orgId = getOrgId(context.orgId)
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return observeOpenAI(client, {
    traceName: context.feature || 'openai-request',
    userId: context.userId || undefined,
    sessionId: context.sessionId || undefined,
    tags: [`org_id:${orgId}`, 'prontoai24'],
    generationMetadata: { org_id: orgId, feature: context.feature || 'unknown' },
  })
}

let langfuseClient: Langfuse | null = null
function getLangfuse() {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return null
  langfuseClient ??= new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  })
  return langfuseClient
}

/** Generic wrapper for providers without a native SDK integration in this repository. */
export async function traceLlmCall<T>(name: string, context: ObservabilityContext, input: unknown, call: () => Promise<T>) {
  const langfuse = getLangfuse()
  if (!langfuse) return call()
  const orgId = getOrgId(context.orgId)
  const trace = langfuse.trace({ name, userId: context.userId || undefined, sessionId: context.sessionId || undefined, tags: [`org_id:${orgId}`, 'prontoai24'], metadata: { org_id: orgId, feature: context.feature || name } })
  const generation = trace.generation({ name, input, metadata: { org_id: orgId } })
  try {
    const output = await call()
    generation.end({ output })
    return output
  } catch (error) {
    generation.end({ output: { error: error instanceof Error ? error.message : 'LLM call failed' } })
    throw error
  } finally {
    await langfuse.flushAsync()
  }
}
