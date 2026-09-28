export const DATABASE_NAME = 'lumina-study'
export const DATABASE_VERSION = 2
export const CHUNKS_STORE = 'chunks'
export const DOCUMENTS_STORE = 'documents'
export const CONVERSATIONS_STORE = 'conversations'

export function openStudyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CHUNKS_STORE)) {
        const store = database.createObjectStore(CHUNKS_STORE, { keyPath: 'id' })
        store.createIndex('documentId', 'documentId', { unique: false })
      }
      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        const store = database.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'))
    request.onblocked = () => reject(new Error('Feche outras abas do Lumina e recarregue a página para atualizar o armazenamento.'))
  })
}

export function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao atualizar o armazenamento local.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('A operação no armazenamento foi cancelada.'))
  })
}
