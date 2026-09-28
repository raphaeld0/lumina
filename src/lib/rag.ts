import type { ChatMessage, RagResponse, SearchResult } from '../types'

type ApiError = {
  message?: string
}

export async function askDocument(
  question: string,
  documentName: string,
  chunks: SearchResult[],
  history: ChatMessage[],
): Promise<RagResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      documentName,
      chunks: chunks.map(({ id, pageNumber, text, score }) => ({ id, pageNumber, text, score })),
      history: history.slice(-8).map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError
    throw new Error(error.message || 'Não foi possível conversar com a IA.')
  }

  return response.json() as Promise<RagResponse>
}
