import { useEffect, useState } from 'react'
import { Menu, PanelLeftOpen } from 'lucide-react'
import { Brand } from './components/Brand'
import { DocumentView } from './components/DocumentView'
import { Sidebar } from './components/Sidebar'
import { UploadPanel } from './components/UploadPanel'
import { createDocumentChunks } from './lib/chunking'
import { WELCOME_MESSAGE } from './lib/conversation'
import {
  deleteStoredConversation,
  listStoredConversations,
  loadStoredConversation,
  renameStoredConversation,
  saveConversationMessages,
  saveStoredConversation,
} from './lib/conversationStore'
import { createEmbeddings } from './lib/embeddings'
import { extractPdf, PdfReadError } from './lib/pdf'
import { saveChunks } from './lib/vectorStore'
import type { ChatMessage, ConversationSummary, PdfDocumentData, UploadError, UploadStatus } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('lumina-sidebar-collapsed') === 'true')
  const [studentName, setStudentName] = useState(() => localStorage.getItem('lumina-student-name') || 'Estudante')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('lumina-theme') === 'dark' ? 'dark' : 'light',
  )
  const [status, setStatus] = useState<UploadStatus>('restoring')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<PdfDocumentData[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [error, setError] = useState<UploadError | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('lumina-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('lumina-student-name', studentName)
  }, [studentName])

  useEffect(() => {
    localStorage.setItem('lumina-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

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
            setConversationId(restored.id)
            setDocuments(restored.documents)
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
    if (!storageReady || !conversationId || documents.length === 0 || status !== 'ready') return
    const timeout = window.setTimeout(() => {
      void saveConversationMessages(conversationId, documents, messages)
        .then(listStoredConversations)
        .then(setConversations)
        .catch(() => undefined)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [conversationId, documents, messages, status, storageReady])

  function startNewConversation() {
    setConversationId(null)
    setDocuments([])
    setMessages([WELCOME_MESSAGE])
    setError(null)
    setProgress({ current: 0, total: 0 })
    setStatus('idle')
    setSidebarOpen(false)
  }

  async function openConversation(id: string) {
    setStatus('restoring')
    setError(null)
    setSidebarOpen(false)

    try {
      const restored = await loadStoredConversation(id)
      if (!restored) throw new Error('Esta conversa não foi encontrada no armazenamento local.')
      setConversationId(restored.id)
      setDocuments(restored.documents)
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

  async function handleRenameConversation(id: string) {
    const current = conversations.find((conversation) => conversation.id === id)
    const title = window.prompt('Novo nome da conversa:', current?.title ?? '')
    if (title === null || !title.trim()) return
    await renameStoredConversation(id, title)
    setConversations(await listStoredConversations())
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm('Excluir esta conversa, seus PDFs e todo o histórico?')) return
    await deleteStoredConversation(id)
    const remaining = await listStoredConversations()
    setConversations(remaining)
    if (conversationId === id) startNewConversation()
  }

  async function handleFile(file: File) {
    const existingDocuments = documents
    const targetConversationId = conversationId ?? crypto.randomUUID()
    setStatus('reading')
    setError(null)
    setProgress({ current: 0, total: 0 })

    try {
      const extracted = await extractPdf(file, (current, total) => setProgress({ current, total }))
      const rawChunks = createDocumentChunks(extracted, targetConversationId)
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
      const readyDocument = { ...extracted, chunkCount: indexedChunks.length, originalFile: file }
      const nextDocuments = [...existingDocuments, readyDocument]
      await saveStoredConversation(targetConversationId, nextDocuments, messages)
      setConversationId(targetConversationId)
      setDocuments(nextDocuments)
      setConversations(await listStoredConversations())
      setStatus('ready')
    } catch (caughtError) {
      const readError = caughtError instanceof PdfReadError ? caughtError : null
      const uploadError = {
        title: readError?.code === 'NO_TEXT'
          ? 'Este PDF não possui texto extraível'
          : readError
            ? 'Não conseguimos ler o arquivo'
            : 'Não foi possível criar o índice',
        message: readError?.code === 'NO_TEXT'
          ? 'Parece ser um documento escaneado ou composto por imagens. A leitura por OCR ainda não está disponível nesta versão.'
          : readError?.message
            ?? (caughtError instanceof Error ? caughtError.message : 'Não foi possível gerar ou armazenar os embeddings locais.'),
      }
      setError(uploadError)
      if (existingDocuments.length > 0) {
        window.alert(`${uploadError.title}\n\n${uploadError.message}`)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        studentName={studentName}
        theme={theme}
        conversations={conversations}
        activeConversationId={conversationId ?? undefined}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => {
          setSidebarCollapsed(true)
          setSidebarOpen(false)
        }}
        onNewConversation={startNewConversation}
        onSelectConversation={(id) => { void openConversation(id) }}
        onRenameConversation={(id) => { void handleRenameConversation(id) }}
        onDeleteConversation={(id) => { void handleDeleteConversation(id) }}
        onStudentNameChange={setStudentName}
        onThemeChange={setTheme}
      />

      <main className={`main-content ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
        {sidebarCollapsed && (
          <button className="sidebar-expand-button" onClick={() => setSidebarCollapsed(false)} aria-label="Mostrar barra lateral" title="Mostrar barra lateral">
            <PanelLeftOpen size={20} />
          </button>
        )}
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <Brand />
          <span className="header-spacer" />
        </header>

        {conversationId && documents.length > 0 && status === 'ready' ? (
          <DocumentView
            key={conversationId}
            conversationId={conversationId}
            documents={documents}
            messages={messages}
            onMessagesChange={setMessages}
            onAddFile={(file) => { void handleFile(file) }}
            onNewConversation={startNewConversation}
          />
        ) : (
          <UploadPanel status={status} error={error} progress={progress} onFile={handleFile} />
        )}
      </main>
    </div>
  )
}

export default App
