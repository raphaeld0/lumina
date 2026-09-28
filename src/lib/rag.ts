import type { ChatMessage, RagResponse, SearchResult } from '../types'

type ApiError = {
  message?: string
}

export async function rewriteDocumentQuery(question: string, history: ChatMessage[]) {
  const response = await fetch('/api/rewrite-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history: history.slice(-8).map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError
    throw new Error(error.message || 'Não foi possível preparar a busca com a IA.')
  }

  const data = await response.json() as { searchQuery: string }
  return data.searchQuery
}

export async function askDocument(
  question: string,
  chunks: SearchResult[],
  history: ChatMessage[],
): Promise<RagResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      chunks: chunks.map(({ id, documentName, pageNumber, text, score }) => ({
        id,
        documentName,
        pageNumber,
        text,
        score,
      })),
      history: history.slice(-8).map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError
    throw new Error(error.message || 'Não foi possível conversar com a IA.')
  }

  return response.json() as Promise<RagResponse>
}
