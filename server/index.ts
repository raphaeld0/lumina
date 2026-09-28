import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import OpenAI from 'openai'
import { ZodError } from 'zod'
import { answerWithRag, RagRequestSchema } from './rag.js'

const app = express()
const port = Number(process.env.PORT) || 3001
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

app.disable('x-powered-by')
app.use(express.json({ limit: '150kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ configured: Boolean(process.env.OPENAI_API_KEY), model })
})

app.post('/api/chat', async (request, response) => {
  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({
      code: 'API_KEY_MISSING',
      message: 'Configure OPENAI_API_KEY no arquivo .env para usar o chat.',
    })
    return
  }

  try {
    const input = RagRequestSchema.parse(request.body)
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const answer = await answerWithRag(client, input, model)
    response.json(answer)
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ code: 'INVALID_REQUEST', message: 'Os dados enviados para o chat são inválidos.' })
      return
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        response.status(401).json({
          code: 'INVALID_API_KEY',
          message: 'A chave da OpenAI não é válida. Verifique OPENAI_API_KEY no arquivo .env.',
        })
        return
      }

      if (error.status === 429) {
        response.status(429).json({
          code: 'API_QUOTA_EXCEEDED',
          message: 'A conta da OpenAI está sem créditos ou atingiu o limite de uso. Verifique o faturamento da API.',
        })
        return
      }
    }

    console.error('RAG request failed:', error instanceof Error ? error.message : error)
    response.status(502).json({
      code: 'AI_REQUEST_FAILED',
      message: 'Não foi possível obter uma resposta da IA. Tente novamente em instantes.',
    })
  }
})

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(currentDirectory, '../dist')
app.use(express.static(distDirectory))
app.get('*', (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))

app.listen(port, () => {
  console.log(`Lumina API disponível em http://localhost:${port}`)
})
