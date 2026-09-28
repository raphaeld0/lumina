import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Brand } from './components/Brand'
import { DocumentView } from './components/DocumentView'
import { Sidebar } from './components/Sidebar'
import { UploadPanel } from './components/UploadPanel'
import { createDocumentChunks } from './lib/chunking'
import { WELCOME_MESSAGE } from './lib/conversation'
import { createStoredConversation, listStoredConversations, loadStoredConversation, saveConversationMessages } from './lib/conversationStore'
import { createEmbeddings } from './lib/embeddings'
import { extractPdf, PdfReadError } from './lib/pdf'
import { saveChunks } from './lib/vectorStore'
import type { ChatMessage, ConversationSummary, PdfDocumentData, UploadError, UploadStatus } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('restoring')
  const [document, setDocument] = useState<PdfDocumentData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [error, setError] = useState<UploadError | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    let active = true

    async function restoreConversation() {
      try {
        const summaries = await listStoredConversations()
        if (!active) return
        setConversations(summaries)

        if (summaries[0]) {
          const restored = await loadStoredConversation(summaries[0].id)
          if (active && restored) {
            setDocument(restored.document)
            setMessages(restored.messages.length > 0 ? restored.messages : [WELCOME_MESSAGE])
            setStatus('ready')
            return
          }
        }
        setStatus('idle')
      } catch (caughtError) {
        if (!active) return
        setError({
          title: 'Não foi possível restaurar as conversas',
          message: caughtError instanceof Error ? caughtError.message : 'O armazenamento local não pôde ser aberto.',
        })
        setStatus('error')
      } finally {
        if (active) setStorageReady(true)
      }
    }

    void restoreConversation()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!storageReady || !document || status !== 'ready') return
    const timeout = window.setTimeout(() => {
      void saveConversationMessages(document.id, document.name, messages)
        .then(listStoredConversations)
        .then(setConversations)
        .catch(() => undefined)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [document, messages, status, storageReady])

  function startNewConversation() {
    setDocument(null)
    setMessages([WELCOME_MESSAGE])
    setError(null)
    setProgress({ current: 0, total: 0 })
    setStatus('idle')
    setSidebarOpen(false)
  }

  async function openConversation(conversationId: string) {
    setStatus('restoring')
    setError(null)
    setSidebarOpen(false)

    try {
      const restored = await loadStoredConversation(conversationId)
      if (!restored) throw new Error('Esta conversa não foi encontrada no armazenamento local.')
      setDocument(restored.document)
      setMessages(restored.messages.length > 0 ? restored.messages : [WELCOME_MESSAGE])
      setStatus('ready')
    } catch (caughtError) {
      setError({
        title: 'Não foi possível abrir a conversa',
        message: caughtError instanceof Error ? caughtError.message : 'Tente novamente em instantes.',
      })
      setStatus('error')
    }
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
      const batchSize = 16
      for (let start = 0; start < rawChunks.length; start += batchSize) {
        const batch = rawChunks.slice(start, start + batchSize)
        const embeddings = await createEmbeddings(batch.map((chunk) => chunk.text), 'document')
        indexedChunks.push(...batch.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })))
        setProgress({ current: Math.min(start + batch.length, rawChunks.length), total: rawChunks.length })
      }

      await saveChunks(indexedChunks)
      const readyDocument = { ...extracted, chunkCount: indexedChunks.length }
      await createStoredConversation(readyDocument, [WELCOME_MESSAGE])
      setDocument(readyDocument)
      setMessages([WELCOME_MESSAGE])
      setConversations(await listStoredConversations())
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
          : readError?.message
            ?? (caughtError instanceof Error ? caughtError.message : 'Não foi possível gerar ou armazenar os embeddings locais.'),
      })
      setStatus('error')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        conversations={conversations}
        activeConversationId={document?.id}
        onClose={() => setSidebarOpen(false)}
        onNewConversation={startNewConversation}
        onSelectConversation={(conversationId) => { void openConversation(conversationId) }}
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
          <DocumentView
            key={document.id}
            document={document}
            messages={messages}
            onMessagesChange={setMessages}
            onReplace={startNewConversation}
            onNewConversation={startNewConversation}
          />
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
