import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { ZodError } from 'zod'
import { answerWithRag, OllamaRequestError, RagRequestSchema } from './rag.js'

const app = express()
const port = Number(process.env.PORT) || 3001
const model = process.env.OLLAMA_MODEL || 'qwen3.5:4b'
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')

app.disable('x-powered-by')
app.use(express.json({ limit: '150kb' }))

app.get('/api/health', async (_request, response) => {
  try {
    const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    })
    response.json({
      configured: ollamaResponse.ok,
      provider: 'ollama',
      model,
    })
  } catch {
    response.json({ configured: false, provider: 'ollama', model })
  }
})

app.post('/api/chat', async (request, response) => {
  try {
    const input = RagRequestSchema.parse(request.body)
    const answer = await answerWithRag(ollamaBaseUrl, input, model)
    response.json(answer)
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ code: 'INVALID_REQUEST', message: 'Os dados enviados para o chat são inválidos.' })
      return
    }

    if (error instanceof OllamaRequestError) {
      response.status(error.code === 'MODEL_NOT_FOUND' ? 424 : 503).json({
        code: error.code,
        message: error.message,
      })
      return
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
