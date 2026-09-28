import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Brand } from './components/Brand'
import { DocumentView } from './components/DocumentView'
import { Sidebar } from './components/Sidebar'
import { UploadPanel } from './components/UploadPanel'
import { createDocumentChunks } from './lib/chunking'
import { createEmbedding } from './lib/embeddings'
import { extractPdf, PdfReadError } from './lib/pdf'
import { deleteChunksByDocument, saveChunks } from './lib/vectorStore'
import type { PdfDocumentData, UploadError, UploadStatus } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [document, setDocument] = useState<PdfDocumentData | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  function resetConversation() {
    if (document) void deleteChunksByDocument(document.id).catch(() => undefined)
    setDocument(null)
    setError(null)
    setProgress({ current: 0, total: 0 })
    setStatus('idle')
    setSidebarOpen(false)
  }

  async function handleFile(file: File) {
    setStatus('reading')
    setError(null)
    setProgress({ current: 0, total: 0 })

    try {
      const extracted = await extractPdf(file, (current, total) => {
        setProgress({ current, total })
      })

      const rawChunks = createDocumentChunks(extracted)
      setStatus('indexing')
      setProgress({ current: 0, total: rawChunks.length })

      const indexedChunks = []
      for (let index = 0; index < rawChunks.length; index += 1) {
        const chunk = rawChunks[index]
        indexedChunks.push({ ...chunk, embedding: createEmbedding(chunk.text) })
        setProgress({ current: index + 1, total: rawChunks.length })

        if (index > 0 && index % 20 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
      }

      await saveChunks(indexedChunks)
      setDocument({ ...extracted, chunkCount: indexedChunks.length })
      setStatus('ready')
    } catch (caughtError) {
      const readError = caughtError instanceof PdfReadError ? caughtError : null
      setError({
        title: readError?.code === 'NO_TEXT'
          ? 'Este PDF não possui texto extraível'
          : readError
            ? 'Não conseguimos ler o arquivo'
            : 'Não foi possível criar o índice',
        message: readError?.code === 'NO_TEXT'
          ? 'Parece ser um documento escaneado ou composto por imagens. A leitura por OCR ainda não está disponível nesta versão.'
          : readError?.message ?? 'O navegador não permitiu armazenar os trechos localmente. Verifique as permissões e tente novamente.',
      })
      setStatus('error')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        documentName={document?.name}
        onClose={() => setSidebarOpen(false)}
        onNewConversation={resetConversation}
      />

      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={21} />
          </button>
          <Brand />
          <span className="header-spacer" />
        </header>

        {document && status === 'ready' ? (
          <DocumentView document={document} onReplace={resetConversation} />
        ) : (
          <UploadPanel status={status} error={error} progress={progress} onFile={handleFile} />
        )}

        <footer className="app-footer">
          Feito para quem quer aprender com mais clareza.
        </footer>
      </main>
    </div>
  )
}

export default App
