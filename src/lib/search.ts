import type { SearchResult } from '../types'
import { cosineSimilarity, createEmbedding } from './embeddings'
import { getChunksByDocument } from './vectorStore'

export async function searchRelevantChunks(
  documentId: string,
  question: string,
  limit = 5,
): Promise<SearchResult[]> {
  const queryEmbedding = createEmbedding(question)
  const chunks = await getChunksByDocument(documentId)

  return chunks
    .map((chunk): SearchResult => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
}
