import type { ChatMessage, ConversationSummary, PdfDocumentData } from '../types'
import {
  CHUNKS_STORE,
  CONVERSATIONS_STORE,
  DOCUMENTS_STORE,
  openStudyDatabase,
  transactionDone,
} from './storage'

type ConversationRecord = {
  id: string
  documentIds?: string[]
  documentNames?: string[]
  documentName?: string
  customTitle?: string
  messages: ChatMessage[]
  updatedAt: number
}

export type RestoredConversation = {
  id: string
  documents: PdfDocumentData[]
  messages: ChatMessage[]
}

function recordDocumentIds(record: ConversationRecord) {
  return record.documentIds?.length ? record.documentIds : [record.id]
}

function recordDocumentNames(record: ConversationRecord) {
  if (record.documentNames?.length) return record.documentNames
  return record.documentName ? [record.documentName] : []
}

export function getConversationTitle(messages: ChatMessage[], documentName: string, customTitle?: string) {
  if (customTitle?.trim()) return customTitle.trim()
  const firstQuestion = messages.find((message) => message.role === 'user')?.content.trim()
  if (!firstQuestion) return `Estudo de ${documentName}`
  return firstQuestion.length > 42 ? `${firstQuestion.slice(0, 42).trim()}…` : firstQuestion
}

function toSummary(record: ConversationRecord): ConversationSummary {
  const names = recordDocumentNames(record)
  const documentName = names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? 'Sem documento')
  return {
    id: record.id,
    documentName,
    documentCount: names.length,
    title: getConversationTitle(record.messages, names[0] ?? 'documentos', record.customTitle),
    updatedAt: record.updatedAt,
  }
}

function getRecord(database: IDBDatabase, id: string) {
  return new Promise<ConversationRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readonly')
    const request = transaction.objectStore(CONVERSATIONS_STORE).get(id)
    request.onsuccess = () => resolve(request.result as ConversationRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a conversa.'))
  })
}

export async function saveStoredConversation(
  conversationId: string,
  documents: PdfDocumentData[],
  messages: ChatMessage[],
) {
  const database = await openStudyDatabase()
  const existing = await getRecord(database, conversationId)
  const transaction = database.transaction([DOCUMENTS_STORE, CONVERSATIONS_STORE], 'readwrite')
  documents.forEach((document) => transaction.objectStore(DOCUMENTS_STORE).put(document))
  transaction.objectStore(CONVERSATIONS_STORE).put({
    id: conversationId,
    documentIds: documents.map((document) => document.id),
    documentNames: documents.map((document) => document.name),
    customTitle: existing?.customTitle,
    messages,
    updatedAt: Date.now(),
  } satisfies ConversationRecord)
  await transactionDone(transaction)
  database.close()
}

export async function saveConversationMessages(
  conversationId: string,
  documents: PdfDocumentData[],
  messages: ChatMessage[],
) {
  const database = await openStudyDatabase()
  const existing = await getRecord(database, conversationId)
  const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
  transaction.objectStore(CONVERSATIONS_STORE).put({
    id: conversationId,
    documentIds: documents.map((document) => document.id),
    documentNames: documents.map((document) => document.name),
    customTitle: existing?.customTitle,
    messages,
    updatedAt: Date.now(),
  } satisfies ConversationRecord)
  await transactionDone(transaction)
  database.close()
}

export async function listStoredConversations() {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CONVERSATIONS_STORE, 'readonly')
  const records = await new Promise<ConversationRecord[]>((resolve, reject) => {
    const request = transaction.objectStore(CONVERSATIONS_STORE).getAll()
    request.onsuccess = () => resolve(request.result as ConversationRecord[])
    request.onerror = () => reject(request.error ?? new Error('Não foi possível listar as conversas.'))
  })
  database.close()
  return records.sort((first, second) => second.updatedAt - first.updatedAt).map(toSummary)
}

export async function loadStoredConversation(conversationId: string): Promise<RestoredConversation | null> {
  const database = await openStudyDatabase()
  const conversation = await getRecord(database, conversationId)
  if (!conversation) {
    database.close()
    return null
  }

  const transaction = database.transaction(DOCUMENTS_STORE, 'readonly')
  const store = transaction.objectStore(DOCUMENTS_STORE)
  const documents = await Promise.all(recordDocumentIds(conversation).map((documentId) =>
    new Promise<PdfDocumentData | undefined>((resolve, reject) => {
      const request = store.get(documentId)
      request.onsuccess = () => resolve(request.result as PdfDocumentData | undefined)
      request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir um dos documentos.'))
    }),
  ))
  database.close()

  const availableDocuments = documents.filter((document): document is PdfDocumentData => Boolean(document))
  if (availableDocuments.length === 0) return null
  return { id: conversation.id, documents: availableDocuments, messages: conversation.messages }
}

export async function renameStoredConversation(conversationId: string, title: string) {
  const database = await openStudyDatabase()
  const record = await getRecord(database, conversationId)
  if (!record) {
    database.close()
    return
  }
  const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
  transaction.objectStore(CONVERSATIONS_STORE).put({
    ...record,
    customTitle: title.trim() || undefined,
    updatedAt: Date.now(),
  } satisfies ConversationRecord)
  await transactionDone(transaction)
  database.close()
}

export async function deleteStoredConversation(conversationId: string) {
  const database = await openStudyDatabase()
  const record = await getRecord(database, conversationId)
  if (!record) {
    database.close()
    return
  }

  const transaction = database.transaction(
    [CONVERSATIONS_STORE, DOCUMENTS_STORE, CHUNKS_STORE],
    'readwrite',
  )
  transaction.objectStore(CONVERSATIONS_STORE).delete(conversationId)
  recordDocumentIds(record).forEach((documentId) => {
    transaction.objectStore(DOCUMENTS_STORE).delete(documentId)
  })

  const chunks = transaction.objectStore(CHUNKS_STORE)
  const cursorRequest = chunks.index('conversationId').openKeyCursor(IDBKeyRange.only(conversationId))
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    chunks.delete(cursor.primaryKey)
    cursor.continue()
  }

  await transactionDone(transaction)
  database.close()
}
