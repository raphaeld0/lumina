import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PdfDocumentData, PdfPage } from '../types'

export const MAX_FILE_SIZE = 20 * 1024 * 1024

export class PdfReadError extends Error {
  code: 'NO_TEXT' | 'INVALID_FILE' | 'PASSWORD' | 'UNKNOWN'

  constructor(
    code: PdfReadError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'PdfReadError'
    this.code = code
  }
}

function pageItemsToText(items: Array<TextItem | unknown>): string {
  let text = ''

  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue

    const textItem = item as TextItem
    const content = textItem.str.trim()
    if (!content) continue

    if (text.length > 0 && !text.endsWith('\n')) text += ' '
    text += content
    if (textItem.hasEOL) text += '\n'
  }

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractPdf(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void,
): Promise<PdfDocumentData> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfReadError('INVALID_FILE', 'O arquivo selecionado não é um PDF válido.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new PdfReadError('INVALID_FILE', 'O PDF ultrapassa o limite de 20 MB.')
  }

  try {
    const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist')
    GlobalWorkerOptions.workerSrc = pdfWorker
    const data = await file.arrayBuffer()
    const document = await getDocument({ data }).promise
    const pages: PdfPage[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.(pageNumber, document.numPages)
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      pages.push({
        pageNumber,
        text: pageItemsToText(textContent.items),
      })
    }

    const characterCount = pages.reduce((total, page) => total + page.text.length, 0)
    if (characterCount === 0) {
      throw new PdfReadError(
        'NO_TEXT',
        'Não encontramos texto selecionável neste PDF. Ele pode ter sido digitalizado como imagem.',
      )
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      pageCount: document.numPages,
      characterCount,
      chunkCount: 0,
      pages,
    }
  } catch (error) {
    if (error instanceof PdfReadError) throw error

    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfReadError('PASSWORD', 'Este PDF é protegido por senha e não pode ser lido.')
    }

    throw new PdfReadError(
      'UNKNOWN',
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}
