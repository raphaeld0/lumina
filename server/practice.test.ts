import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { generatePracticeSet, PracticeRequestSchema, type PracticeRequest } from './practice.js'

const request: PracticeRequest = {
  kind: 'quiz',
  topic: 'fotossíntese',
  chunks: [
    { id: 'c1', documentName: 'biologia.pdf', pageNumber: 2, text: 'A clorofila absorve luz.' },
    { id: 'c2', documentName: 'biologia.pdf', pageNumber: 3, text: 'A fotossíntese produz glicose.' },
  ],
}

test('mapeia as fontes do simulado para documento e página', async () => {
  let receivedBody: Record<string, unknown> | undefined
  const server = createServer((incomingRequest, outgoingResponse) => {
    const parts: Buffer[] = []
    incomingRequest.on('data', (part: Buffer) => parts.push(part))
    incomingRequest.on('end', () => {
      receivedBody = JSON.parse(Buffer.concat(parts).toString('utf8')) as Record<string, unknown>
      outgoingResponse.writeHead(200, { 'Content-Type': 'application/json' })
      outgoingResponse.end(JSON.stringify({ message: { content: JSON.stringify({ items: [
        { question: 'O que a clorofila absorve?', options: ['Luz', 'Glicose', 'Sal', 'Proteína'], correctIndex: 0, explanation: 'A clorofila absorve luz.', citationIds: ['S1'] },
        { question: 'O que a fotossíntese produz?', options: ['Sal', 'Glicose', 'Proteína', 'Clorofila'], correctIndex: 1, explanation: 'A fotossíntese produz glicose.', citationIds: ['S2'] },
      ] }) } }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  try {
    const result = await generatePracticeSet(`http://127.0.0.1:${address.port}`, request, 'qwen3.5:0.8b')
    assert.equal(result.kind, 'quiz')
    assert.equal(result.items.length, 2)
    assert.equal(result.items[0].sources[0].documentName, 'biologia.pdf')
    assert.equal(result.items[0].sources[0].pageNumber, 2)
    assert.equal(receivedBody?.model, 'qwen3.5:0.8b')
    assert.equal(typeof receivedBody?.format, 'object')
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('limita a geração a dois trechos', () => {
  const parsed = PracticeRequestSchema.safeParse({
    ...request,
    chunks: [...request.chunks, request.chunks[0]],
  })
  assert.equal(parsed.success, false)
})
