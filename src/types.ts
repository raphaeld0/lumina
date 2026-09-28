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
}

export type DocumentChunk = {
  id: string
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

export type UploadStatus = 'idle' | 'reading' | 'indexing' | 'ready' | 'error'

export type UploadError = {
  title: string
  message: string
}
