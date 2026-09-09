import { retrieveKnowledge } from '@/lib/knowledge/ingestion'

export async function buildKnowledgePrompt(orgId: string, userQuery: string, basePrompt = '') {
  const matches = await retrieveKnowledge(orgId, userQuery)
  const context = matches.map((match: any, index: number) => `[Fonte ${index + 1}]\n${match.content}`).join('\n\n')
  if (!context) return basePrompt
  return `${basePrompt}\n\nCONTESTO KNOWLEDGE BASE DEL TENANT:\n${context}\n\nUsa il contesto solo per rispondere. Se la risposta non è presente, dichiaralo e non inventare informazioni.`.trim()
}

export async function generateKnowledgeReply(orgId: string, userQuery: string, basePrompt = 'Sei l’assistente clienti di ProntoAI24. Rispondi in italiano, in modo chiaro e conciso.') {
  const matches = await retrieveKnowledge(orgId, userQuery)
  const context = matches.map((match: any, index: number) => `[Fonte ${index + 1}]\n${match.content}`).join('\n\n')
  const prompt = `${basePrompt}${context ? `\n\nCONTESTO KNOWLEDGE BASE DEL TENANT:\n${context}\n\nUsa il contesto solo per rispondere. Se la risposta non è presente, dichiaralo e non inventare informazioni.` : ''}`.trim()
  if (!process.env.OPENAI_API_KEY) return { reply: null, prompt, matches: 0 }
  const startedAt = Date.now()
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.RAG_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userQuery },
      ],
    }),
  })
  if (!response.ok) throw new Error(`RAG chat HTTP ${response.status}`)
  const data = await response.json() as any
  const usage = data.usage || {}
  const inputTokens = Number(usage.prompt_tokens || 0)
  const outputTokens = Number(usage.completion_tokens || 0)
  const model = data.model || process.env.RAG_CHAT_MODEL || 'gpt-4o-mini'
  const inputRate = Number(process.env.RAG_INPUT_COST_USD_PER_1K || 0.00015)
  const outputRate = Number(process.env.RAG_OUTPUT_COST_USD_PER_1K || 0.0006)
  return { reply: data.choices?.[0]?.message?.content || null, prompt, matches: matches.length, usage: { model, inputTokens, outputTokens, totalTokens: Number(usage.total_tokens || inputTokens + outputTokens), latencyMs: Date.now() - startedAt, costUsd: (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate } }
}
