import type { ChatMessage, ConversationSummary, PdfDocumentData } from '../types'
import { CONVERSATIONS_STORE, DOCUMENTS_STORE, openStudyDatabase, transactionDone } from './storage'

type ConversationRecord = {
  id: string
  documentName: string
  messages: ChatMessage[]
  updatedAt: number
}

export type RestoredConversation = {
  document: PdfDocumentData
  messages: ChatMessage[]
}

export function getConversationTitle(messages: ChatMessage[], documentName: string) {
  const firstQuestion = messages.find((message) => message.role === 'user')?.content.trim()
  if (!firstQuestion) return `Estudo de ${documentName}`
  return firstQuestion.length > 42 ? `${firstQuestion.slice(0, 42).trim()}…` : firstQuestion
}

function toSummary(record: ConversationRecord): ConversationSummary {
  return {
    id: record.id,
    documentName: record.documentName,
    title: getConversationTitle(record.messages, record.documentName),
    updatedAt: record.updatedAt,
  }
}

export async function createStoredConversation(document: PdfDocumentData, messages: ChatMessage[]) {
  const database = await openStudyDatabase()
  const transaction = database.transaction([DOCUMENTS_STORE, CONVERSATIONS_STORE], 'readwrite')
  transaction.objectStore(DOCUMENTS_STORE).put(document)
  transaction.objectStore(CONVERSATIONS_STORE).put({
    id: document.id,
    documentName: document.name,
    messages,
    updatedAt: Date.now(),
  } satisfies ConversationRecord)
  await transactionDone(transaction)
  database.close()
}

export async function saveConversationMessages(
  documentId: string,
  documentName: string,
  messages: ChatMessage[],
) {
  const database = await openStudyDatabase()
  const transaction = database.transaction(CONVERSATIONS_STORE, 'readwrite')
  transaction.objectStore(CONVERSATIONS_STORE).put({
    id: documentId,
    documentName,
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

export async function loadStoredConversation(documentId: string): Promise<RestoredConversation | null> {
  const database = await openStudyDatabase()
  const transaction = database.transaction([DOCUMENTS_STORE, CONVERSATIONS_STORE], 'readonly')
  const documentRequest = transaction.objectStore(DOCUMENTS_STORE).get(documentId)
  const conversationRequest = transaction.objectStore(CONVERSATIONS_STORE).get(documentId)

  const [document, conversation] = await Promise.all([
    new Promise<PdfDocumentData | undefined>((resolve, reject) => {
      documentRequest.onsuccess = () => resolve(documentRequest.result as PdfDocumentData | undefined)
      documentRequest.onerror = () => reject(documentRequest.error)
    }),
    new Promise<ConversationRecord | undefined>((resolve, reject) => {
      conversationRequest.onsuccess = () => resolve(conversationRequest.result as ConversationRecord | undefined)
      conversationRequest.onerror = () => reject(conversationRequest.error)
    }),
  ])
  database.close()

  if (!document || !conversation) return null
  return { document, messages: conversation.messages }
}
