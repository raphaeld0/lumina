import type { DocumentChunk, PdfDocumentData } from '../types'

const TARGET_CHUNK_SIZE = 900
const CHUNK_OVERLAP = 140

function findChunkEnd(text: string, start: number) {
  const proposedEnd = Math.min(start + TARGET_CHUNK_SIZE, text.length)
  if (proposedEnd === text.length) return proposedEnd

  const searchStart = start + Math.floor(TARGET_CHUNK_SIZE * 0.65)
  const candidates = [
    text.lastIndexOf('\n\n', proposedEnd),
    text.lastIndexOf('. ', proposedEnd),
    text.lastIndexOf('? ', proposedEnd),
    text.lastIndexOf('! ', proposedEnd),
    text.lastIndexOf(' ', proposedEnd),
  ].filter((position) => position >= searchStart)

  return candidates.length > 0 ? Math.max(...candidates) + 1 : proposedEnd
}

function chunkPage(text: string) {
  const normalized = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return []

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const end = findChunkEnd(normalized, start)
    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end === normalized.length) break

    const nextStart = Math.max(start + 1, end - CHUNK_OVERLAP)
    const nextWord = normalized.indexOf(' ', nextStart)
    start = nextWord >= 0 && nextWord < end ? nextWord + 1 : nextStart
  }

  return chunks
}

export function createDocumentChunks(
  document: PdfDocumentData,
  conversationId: string,
): Array<Omit<DocumentChunk, 'embedding'>> {
  return document.pages.flatMap((page) =>
    chunkPage(page.text).map((text, chunkIndex) => ({
      id: `${document.id}:p${page.pageNumber}:c${chunkIndex}`,
      conversationId,
      documentId: document.id,
      documentName: document.name,
      pageNumber: page.pageNumber,
      chunkIndex,
      text,
    })),
  )
}
