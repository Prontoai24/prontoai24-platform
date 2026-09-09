import { retrieveKnowledge } from '@/lib/knowledge/ingestion'

export async function buildKnowledgePrompt(orgId: string, userQuery: string, basePrompt = '') {
  const matches = await retrieveKnowledge(orgId, userQuery)
  const context = matches.map((match: any, index: number) => `[Fonte ${index + 1}]\n${match.content}`).join('\n\n')
  if (!context) return basePrompt
  return `${basePrompt}\n\nCONTESTO KNOWLEDGE BASE DEL TENANT:\n${context}\n\nUsa il contesto solo per rispondere. Se la risposta non è presente, dichiaralo e non inventare informazioni.`.trim()
}
