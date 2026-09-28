import type { DocumentChunk } from '../types'

const DATABASE_NAME = 'lumina-study'
const DATABASE_VERSION = 1
const CHUNKS_STORE = 'chunks'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CHUNKS_STORE)) {
        const store = database.createObjectStore(CHUNKS_STORE, { keyPath: 'id' })
        store.createIndex('documentId', 'documentId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao salvar a indexação.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('A indexação foi cancelada.'))
  })
}

export async function saveChunks(chunks: DocumentChunk[]) {
  const database = await openDatabase()
  const transaction = database.transaction(CHUNKS_STORE, 'readwrite')
  const store = transaction.objectStore(CHUNKS_STORE)
  chunks.forEach((chunk) => store.put(chunk))
  await transactionDone(transaction)
  database.close()
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const database = await openDatabase()
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

export async function deleteChunksByDocument(documentId: string) {
  const database = await openDatabase()
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
