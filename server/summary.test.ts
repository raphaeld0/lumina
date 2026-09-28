import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { generateSummary, type SummaryRequest } from './summary.js'

test('gera resumo estruturado preservando documento e página das fontes', async () => {
  const request: SummaryRequest = {
    chunks: [{ id: 'c1', documentName: 'historia.pdf', pageNumber: 8, text: 'A Revolução Industrial começou na Inglaterra.' }],
  }
  const server = createServer((_incomingRequest, outgoingResponse) => {
    outgoingResponse.writeHead(200, { 'Content-Type': 'application/json' })
    outgoingResponse.end(JSON.stringify({ message: { content: JSON.stringify({
      title: 'Revolução Industrial',
      summary: 'A Revolução Industrial teve início na Inglaterra.',
      keyPoints: ['Começou na Inglaterra', 'Foi uma revolução industrial'],
      citationIds: ['S1'],
    }) } }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  try {
    const result = await generateSummary(`http://127.0.0.1:${address.port}`, request, 'qwen3.5:0.8b')
    assert.equal(result.kind, 'summary')
    assert.equal(result.sources[0].documentName, 'historia.pdf')
    assert.equal(result.sources[0].pageNumber, 8)
    assert.equal(result.keyPoints.length, 2)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
