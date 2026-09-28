import type { PracticeSet } from '../types'
import { searchRelevantChunks } from './search'

export async function createPracticeSet(conversationId: string, kind: 'flashcards' | 'quiz', topic: string) {
  const selected = await searchRelevantChunks(conversationId, topic, 2)
  if (selected.length === 0) throw new Error('Não há trechos indexados para criar exercícios.')

  const response = await fetch('/api/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      topic,
      chunks: selected.map(({ id, documentName, pageNumber, text }) => ({ id, documentName, pageNumber, text })),
    }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message || 'Não foi possível criar os exercícios.')
  }
  return response.json() as Promise<PracticeSet>
}
