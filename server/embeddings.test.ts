import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createOllamaEmbeddings } from './embeddings.js'

test('gera embeddings em lote com o prefixo adequado para documentos', async () => {
  let receivedBody: Record<string, unknown> | undefined
  const server = createServer((incomingRequest, outgoingResponse) => {
    const parts: Buffer[] = []
    incomingRequest.on('data', (part: Buffer) => parts.push(part))
    incomingRequest.on('end', () => {
      receivedBody = JSON.parse(Buffer.concat(parts).toString('utf8')) as Record<string, unknown>
      outgoingResponse.writeHead(200, { 'Content-Type': 'application/json' })
      outgoingResponse.end(JSON.stringify({ embeddings: [[1, 0, 0], [0, 1, 0]] }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  try {
    const embeddings = await createOllamaEmbeddings(`http://127.0.0.1:${address.port}`, {
      inputs: ['primeiro trecho', 'segundo trecho'],
      purpose: 'document',
    }, 'nomic-embed-text-v2-moe')

    assert.equal(embeddings.length, 2)
    assert.deepEqual(receivedBody?.input, [
      'search_document: primeiro trecho',
      'search_document: segundo trecho',
    ])
    assert.equal(receivedBody?.model, 'nomic-embed-text-v2-moe')
    assert.equal(receivedBody?.truncate, true)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('usa o prefixo de consulta ao gerar o vetor da pergunta', async () => {
  let receivedInput: unknown
  const server = createServer((incomingRequest, outgoingResponse) => {
    const parts: Buffer[] = []
    incomingRequest.on('data', (part: Buffer) => parts.push(part))
    incomingRequest.on('end', () => {
      const body = JSON.parse(Buffer.concat(parts).toString('utf8')) as { input?: unknown }
      receivedInput = body.input
      outgoingResponse.writeHead(200, { 'Content-Type': 'application/json' })
      outgoingResponse.end(JSON.stringify({ embeddings: [[0.5, 0.5]] }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  try {
    await createOllamaEmbeddings(`http://127.0.0.1:${address.port}`, {
      inputs: ['o que é inteligência artificial?'],
      purpose: 'query',
    }, 'nomic-embed-text-v2-moe')
    assert.deepEqual(receivedInput, ['search_query: o que é inteligência artificial?'])
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
