import { z } from 'zod'
import { OllamaRequestError } from './rag.js'

export const EmbeddingRequestSchema = z.object({
  inputs: z.array(z.string().trim().min(1).max(4000)).min(1).max(32),
  purpose: z.enum(['document', 'query']),
})

const OllamaEmbeddingResponseSchema = z.object({
  embeddings: z.array(z.array(z.number().finite()).min(1)).min(1),
})

export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>

export async function createOllamaEmbeddings(
  baseUrl: string,
  request: EmbeddingRequest,
  model: string,
) {
  const prefix = request.purpose === 'query' ? 'search_query: ' : 'search_document: '
  let response: Response

  try {
    response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        input: request.inputs.map((input) => `${prefix}${input}`),
        truncate: true,
      }),
    })
  } catch {
    throw new OllamaRequestError(
      'OLLAMA_UNAVAILABLE',
      'O Ollama não está acessível. Abra o aplicativo Ollama e tente novamente.',
    )
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as { error?: string }
    const message = errorBody.error ?? `O Ollama respondeu com HTTP ${response.status}.`
    const isMissingModel = response.status === 404 || /model.+not found/i.test(message)
    throw new OllamaRequestError(
      isMissingModel ? 'MODEL_NOT_FOUND' : 'OLLAMA_ERROR',
      isMissingModel
        ? `O modelo de embeddings ${model} não está instalado. Execute: ollama pull ${model}`
        : message,
    )
  }

  try {
    const result = OllamaEmbeddingResponseSchema.parse(await response.json())
    if (result.embeddings.length !== request.inputs.length) throw new Error('Embedding count mismatch')
    return result.embeddings
  } catch {
    throw new OllamaRequestError(
      'INVALID_RESPONSE',
      'O modelo local retornou embeddings inválidos. Tente indexar o documento novamente.',
    )
  }
}
