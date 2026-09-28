import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { answerWithRag, mapModelAnswer, type RagRequest } from './rag.js'

const request: RagRequest = {
  question: 'O que é fotossíntese?',
  documentName: 'biologia.pdf',
  history: [],
  chunks: [
    { id: 'chunk-1', pageNumber: 7, text: 'Fotossíntese converte energia luminosa em energia química.', score: 0.8 },
    { id: 'chunk-2', pageNumber: 9, text: 'As raízes absorvem água e sais minerais.', score: 0.4 },
  ],
}

test('retorna resposta e somente as páginas citadas quando há informação', () => {
  const result = mapModelAnswer(request, {
    answer: 'É a conversão de energia luminosa em energia química.',
    sufficient: true,
    citationIds: ['S1', 'S99'],
  })

  assert.equal(result.sufficient, true)
  assert.equal(result.sources.length, 1)
  assert.equal(result.sources[0].pageNumber, 7)
})

test('informa insuficiência e não apresenta fontes quando o PDF não responde', () => {
  const result = mapModelAnswer(request, {
    answer: 'Brasília.',
    sufficient: false,
    citationIds: ['S1'],
  })

  assert.equal(result.sufficient, false)
  assert.equal(result.sources.length, 0)
  assert.match(result.answer, /informação suficiente/i)
})

test('rejeita resposta que cita uma fonte inexistente', () => {
  const result = mapModelAnswer(request, {
    answer: 'Resposta sem uma fonte verificável.',
    sufficient: true,
    citationIds: ['S99'],
  })

  assert.equal(result.sufficient, false)
  assert.equal(result.sources.length, 0)
  assert.match(result.answer, /informação suficiente/i)
})

test('envia o RAG ao Ollama local com schema estruturado', async () => {
  let receivedBody: Record<string, unknown> | undefined
  const server = createServer((incomingRequest, outgoingResponse) => {
    const parts: Buffer[] = []
    incomingRequest.on('data', (part: Buffer) => parts.push(part))
    incomingRequest.on('end', () => {
      receivedBody = JSON.parse(Buffer.concat(parts).toString('utf8')) as Record<string, unknown>
      outgoingResponse.writeHead(200, { 'Content-Type': 'application/json' })
      outgoingResponse.end(JSON.stringify({
        message: {
          role: 'assistant',
          content: JSON.stringify({
            answer: 'A fotossíntese converte energia luminosa em energia química.',
            sufficient: true,
            citationIds: ['S1'],
          }),
        },
        done: true,
      }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  try {
    const result = await answerWithRag(`http://127.0.0.1:${address.port}`, request, 'qwen3.5:4b')
    assert.equal(result.sufficient, true)
    assert.equal(result.sources[0].pageNumber, 7)
    assert.equal(receivedBody?.model, 'qwen3.5:4b')
    assert.equal(receivedBody?.stream, false)
    assert.equal(receivedBody?.think, false)
    assert.equal(typeof receivedBody?.format, 'object')
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
