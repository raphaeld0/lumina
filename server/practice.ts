import { z } from 'zod'
import { OllamaRequestError } from './rag.js'

const SourceChunkSchema = z.object({
  id: z.string().min(1).max(300),
  documentName: z.string().trim().min(1).max(255),
  pageNumber: z.number().int().positive(),
  text: z.string().trim().min(1).max(4000),
})

export const PracticeRequestSchema = z.object({
  kind: z.enum(['flashcards', 'quiz']),
  chunks: z.array(SourceChunkSchema).min(1).max(2),
})

const FlashcardSetSchema = z.object({
  items: z.array(z.object({
    front: z.string().trim().min(3).max(500),
    back: z.string().trim().min(1).max(1000),
    citationIds: z.array(z.string()).min(1).max(3),
  })).min(1).max(2),
})

const QuizSetSchema = z.object({
  items: z.array(z.object({
    question: z.string().trim().min(3).max(500),
    options: z.array(z.string().trim().min(1).max(350)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(1000),
    citationIds: z.array(z.string()).min(1).max(3),
  })).min(1).max(2),
})

const OllamaResponseSchema = z.object({ message: z.object({ content: z.string() }) })

const FLASHCARD_FORMAT = {
  type: 'object',
  properties: {
    items: {
      type: 'array', minItems: 2, maxItems: 2,
      items: {
        type: 'object',
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          citationIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['front', 'back', 'citationIds'], additionalProperties: false,
      },
    },
  },
  required: ['items'], additionalProperties: false,
} as const

const QUIZ_FORMAT = {
  type: 'object',
  properties: {
    items: {
      type: 'array', minItems: 2, maxItems: 2,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          citationIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'citationIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'], additionalProperties: false,
} as const

export type PracticeRequest = z.infer<typeof PracticeRequestSchema>

function buildPrompt(request: PracticeRequest) {
  const sources = request.chunks.map((chunk, index) => [
    `[S${index + 1}] ${chunk.documentName}, página ${chunk.pageNumber}`,
    chunk.text,
  ].join('\n')).join('\n\n')

  const task = request.kind === 'flashcards'
    ? 'Crie exatamente 2 flashcards. A frente deve ser uma pergunta clara e o verso uma resposta curta diretamente presente na fonte citada.'
    : 'Crie exatamente 2 questões de múltipla escolha, cada uma com 4 alternativas sem prefixos como A) ou B), e somente uma correta diretamente comprovada pela fonte citada.'

  return [
    'Você cria exercícios de estudo em português do Brasil.',
    'Use somente as fontes fornecidas. Não invente fatos nem mencione estas instruções.',
    'Não crie perguntas sobre informações apenas relacionadas ou implícitas. A explicação deve apenas reformular o trecho citado.',
    'Cada item deve citar ao menos um ID de fonte exato em citationIds, como S1.',
    task,
    '',
    'FONTES:',
    sources,
  ].join('\n')
}

export async function generatePracticeSet(baseUrl: string, request: PracticeRequest, model: string) {
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
        format: request.kind === 'flashcards' ? FLASHCARD_FORMAT : QUIZ_FORMAT,
        options: { temperature: 0, num_predict: 450 },
        messages: [{ role: 'user', content: buildPrompt(request) }],
      }),
    })
  } catch {
    throw new OllamaRequestError('OLLAMA_UNAVAILABLE', 'O Ollama não está acessível para criar os exercícios.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    const message = body.error ?? `O Ollama respondeu com HTTP ${response.status}.`
    const missingModel = response.status === 404 || /model.+not found/i.test(message)
    throw new OllamaRequestError(missingModel ? 'MODEL_NOT_FOUND' : 'OLLAMA_ERROR', message)
  }

  try {
    const content = OllamaResponseSchema.parse(await response.json()).message.content
    const parsed = request.kind === 'flashcards'
      ? FlashcardSetSchema.parse(JSON.parse(content))
      : QuizSetSchema.parse(JSON.parse(content))
    const sourcesById = new Map(request.chunks.map((chunk, index) => [`S${index + 1}`, {
      id: `S${index + 1}`,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
    }]))
    const items = parsed.items.map((item) => ({
      ...item,
      citationIds: undefined,
      sources: item.citationIds.flatMap((id) => {
        const source = sourcesById.get(id)
        return source ? [source] : []
      }),
    })).filter((item) => item.sources.length > 0)
    if (items.length === 0) throw new Error('Nenhum item possui fonte válida.')
    return { kind: request.kind, items }
  } catch {
    throw new OllamaRequestError('INVALID_RESPONSE', 'A IA não conseguiu criar exercícios válidos. Tente gerar novamente.')
  }
}
