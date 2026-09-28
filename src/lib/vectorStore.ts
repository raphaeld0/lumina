import type { DocumentChunk } from '../types'
import { CHUNKS_STORE, openStudyDatabase, transactionDone } from './storage'

export async function saveChunks(chunks: DocumentChunk[]) {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CHUNKS_STORE, 'readwrite')
  const store = transaction.objectStore(CHUNKS_STORE)
  chunks.forEach((chunk) => store.put(chunk))
  await transactionDone(transaction)
  database.close()
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CHUNKS_STORE, 'readonly')
  const index = transaction.objectStore(CHUNKS_STORE).index('documentId')

  const chunks = await new Promise<DocumentChunk[]>((resolve, reject) => {
    const request = index.getAll(documentId)
    request.onsuccess = () => resolve(request.result as DocumentChunk[])
    request.onerror = () => reject(request.error ?? new Error('Falha ao consultar os trechos.'))
  })

  database.close()
  return chunks
}

export async function getChunksByConversation(conversationId: string): Promise<DocumentChunk[]> {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CHUNKS_STORE, 'readonly')
  const index = transaction.objectStore(CHUNKS_STORE).index('conversationId')

  const chunks = await new Promise<DocumentChunk[]>((resolve, reject) => {
    const request = index.getAll(conversationId)
    request.onsuccess = () => resolve(request.result as DocumentChunk[])
    request.onerror = () => reject(request.error ?? new Error('Falha ao consultar os trechos da conversa.'))
  })

  database.close()
  return chunks
}

export async function deleteChunksByDocument(documentId: string) {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CHUNKS_STORE, 'readwrite')
  const index = transaction.objectStore(CHUNKS_STORE).index('documentId')
  const cursorRequest = index.openKeyCursor(IDBKeyRange.only(documentId))

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    transaction.objectStore(CHUNKS_STORE).delete(cursor.primaryKey)
    cursor.continue()
  }

  await transactionDone(transaction)
  database.close()
}
