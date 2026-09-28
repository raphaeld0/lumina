import type { DocumentChunk, PracticeSet } from '../types'
import { getChunksByConversation } from './vectorStore'

export function selectDiverseChunks(chunks: DocumentChunk[], limit: number) {
  const groups = new Map<string, DocumentChunk[]>()
  chunks.forEach((chunk) => {
    const group = groups.get(chunk.documentId) ?? []
    group.push(chunk)
    groups.set(chunk.documentId, group)
  })

  const selected: DocumentChunk[] = []
  for (const group of groups.values()) {
    if (selected.length === limit) break
    selected.push(group[Math.floor(group.length / 2)])
  }

  for (let index = 0; selected.length < limit && index < chunks.length; index += 1) {
    const position = Math.floor((index + 1) * chunks.length / (limit + 1))
    const candidate = chunks[Math.min(position, chunks.length - 1)]
    if (!selected.some((chunk) => chunk.id === candidate.id)) selected.push(candidate)
  }
  return selected
}

export async function createPracticeSet(conversationId: string, kind: 'flashcards' | 'quiz') {
  const chunks = await getChunksByConversation(conversationId)
  const selected = selectDiverseChunks(chunks, 2)
  if (selected.length === 0) throw new Error('Não há trechos indexados para criar exercícios.')

  const response = await fetch('/api/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      chunks: selected.map(({ id, documentName, pageNumber, text }) => ({ id, documentName, pageNumber, text })),
    }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message || 'Não foi possível criar os exercícios.')
  }
  return response.json() as Promise<PracticeSet>
}
