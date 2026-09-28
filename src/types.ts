export type PdfPage = {
  pageNumber: number
  text: string
}

export type PdfDocumentData = {
  id: string
  name: string
  size: number
  pageCount: number
  characterCount: number
  chunkCount: number
  pages: PdfPage[]
  originalFile?: Blob
}

export type DocumentChunk = {
  id: string
  conversationId: string
  documentId: string
  documentName: string
  pageNumber: number
  chunkIndex: number
  text: string
  embedding: number[]
}

export type SearchResult = DocumentChunk & {
  score: number
}

export type ChatSource = {
  id: string
  documentName: string
  pageNumber: number
  text: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sufficient?: boolean
  sources?: ChatSource[]
  usedContext?: boolean
}

export type ConversationSummary = {
  id: string
  documentName: string
  documentCount: number
  title: string
  updatedAt: number
}

export type RagResponse = {
  answer: string
  sufficient: boolean
  sources: ChatSource[]
}

export type PracticeSource = {
  id: string
  documentName: string
  pageNumber: number
}

export type FlashcardSet = {
  kind: 'flashcards'
  items: Array<{
    front: string
    back: string
    sources: PracticeSource[]
  }>
}

export type QuizSet = {
  kind: 'quiz'
  items: Array<{
    question: string
    options: string[]
    correctIndex: number
    explanation: string
    sources: PracticeSource[]
  }>
}

export type PracticeSet = FlashcardSet | QuizSet

export type SummarySet = {
  kind: 'summary'
  title: string
  summary: string
  keyPoints: string[]
  sources: PracticeSource[]
}

export type StudyMaterial = PracticeSet | SummarySet

export type UploadStatus = 'idle' | 'restoring' | 'reading' | 'indexing' | 'ready' | 'error'

export type UploadError = {
  title: string
  message: string
}
