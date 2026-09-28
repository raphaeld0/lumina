import { z } from 'zod'
import { OllamaRequestError } from './rag.js'

export const SummaryRequestSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  chunks: z.array(z.object({
    id: z.string().min(1).max(300),
    documentName: z.string().trim().min(1).max(255),
    pageNumber: z.number().int().positive(),
    text: z.string().trim().min(1).max(4000),
  })).min(1).max(3),
})

const ModelSummarySchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(10).max(2500),
  keyPoints: z.array(z.string().trim().min(2).max(500)).min(2).max(5),
  citationIds: z.array(z.string()).min(1).max(3),
})

const OllamaResponseSchema = z.object({ message: z.object({ content: z.string() }) })

const SUMMARY_FORMAT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    keyPoints: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
    citationIds: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
  },
  required: ['title', 'summary', 'keyPoints', 'citationIds'],
  additionalProperties: false,
} as const

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>

export async function generateSummary(baseUrl: string, request: SummaryRequest, model: string) {
  const sources = request.chunks.map((chunk, index) =>
    `[S${index + 1}] ${chunk.documentName}, página ${chunk.pageNumber}\n${chunk.text}`,
  ).join('\n\n')

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        format: SUMMARY_FORMAT,
        options: { temperature: 0, num_predict: 500 },
        messages: [{
          role: 'user',
          content: [
            'Crie um resumo de estudo em português do Brasil usando somente as fontes abaixo.',
            'Não acrescente conhecimento externo. Produza um título, um parágrafo de resumo e de 2 a 5 pontos principais.',
            `Concentre o resumo no assunto solicitado: ${request.topic}.`,
            'citationIds deve conter os IDs exatos das fontes utilizadas.',
            '', 'FONTES:', sources,
          ].join('\n'),
        }],
      }),
    })
  } catch {
    throw new OllamaRequestError('OLLAMA_UNAVAILABLE', 'O Ollama não está acessível para criar o resumo.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    const message = body.error ?? `O Ollama respondeu com HTTP ${response.status}.`
    const missingModel = response.status === 404 || /model.+not found/i.test(message)
    throw new OllamaRequestError(missingModel ? 'MODEL_NOT_FOUND' : 'OLLAMA_ERROR', message)
  }

  try {
    const content = OllamaResponseSchema.parse(await response.json()).message.content
    const summary = ModelSummarySchema.parse(JSON.parse(content))
    const sourceMap = new Map(request.chunks.map((chunk, index) => [`S${index + 1}`, {
      id: `S${index + 1}`,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
    }]))
    const mappedSources = summary.citationIds.flatMap((id) => {
      const source = sourceMap.get(id)
      return source ? [source] : []
    })
    if (mappedSources.length === 0) throw new Error('O resumo não citou fontes válidas.')
    return {
      kind: 'summary' as const,
      title: summary.title,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      sources: mappedSources,
    }
  } catch {
    throw new OllamaRequestError('INVALID_RESPONSE', 'A IA não conseguiu criar um resumo válido. Tente novamente.')
  }
}
