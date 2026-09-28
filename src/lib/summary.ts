import type { SummarySet } from '../types'
import { selectDiverseChunks } from './practice'
import { getChunksByConversation } from './vectorStore'

export async function createSummary(conversationId: string) {
  const chunks = await getChunksByConversation(conversationId)
  const selected = selectDiverseChunks(chunks, 3)
  if (selected.length === 0) throw new Error('Não há trechos indexados para criar um resumo.')

  const response = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chunks: selected.map(({ id, documentName, pageNumber, text }) => ({ id, documentName, pageNumber, text })),
    }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message || 'Não foi possível criar o resumo.')
  }
  return response.json() as Promise<SummarySet>
}
