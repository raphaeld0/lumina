import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Check, ChevronDown, ExternalLink, FileCheck2, FilePlus2, FileQuestion, FileText, MessageCircleQuestion, RotateCcw, ScanEye, Search } from 'lucide-react'
import type { ChatMessage, PdfDocumentData } from '../types'
import { DocumentChat } from './DocumentChat'
import { PracticePanel } from './PracticePanel'
import { StudyToolsPanel } from './StudyToolsPanel'
import { SummaryPanel } from './SummaryPanel'
import type { PracticeHistoryEntry } from '../lib/practiceHistory'

type DocumentViewProps = {
  conversationId: string
  documents: PdfDocumentData[]
  messages: ChatMessage[]
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>
  onAddFile: (file: File) => void
  onReplace: () => void
  onNewConversation: () => void
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function DocumentView({
  conversationId,
  documents,
  messages,
  onMessagesChange,
  onAddFile,
  onReplace,
  onNewConversation,
}: DocumentViewProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState(documents[0].id)
  const [selectedPage, setSelectedPage] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'practice' | 'summary' | 'text' | 'pdf'>('chat')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [practiceKind, setPracticeKind] = useState<'flashcards' | 'quiz'>('flashcards')
  const [restoredPractice, setRestoredPractice] = useState<PracticeHistoryEntry | null>(null)
  const [restoredSummary, setRestoredSummary] = useState<PracticeHistoryEntry | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const document = documents.find((item) => item.id === selectedDocumentId) ?? documents[0]
  const totalChunks = documents.reduce((total, item) => total + item.chunkCount, 0)

  useEffect(() => {
    if (!documents.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId(documents[0].id)
    }
  }, [documents, selectedDocumentId])

  useEffect(() => {
    if (!document.originalFile) {
      setPdfUrl(null)
      return
    }
    const url = URL.createObjectURL(document.originalFile)
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [document.id, document.originalFile])

  const visiblePages = useMemo(() => {
    const pages = selectedPage === 'all'
      ? document.pages
      : document.pages.filter((page) => page.pageNumber === selectedPage)
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalizedQuery) return pages
    return pages.filter((page) => page.text.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
  }, [document.pages, query, selectedPage])

  function selectDocument(documentId: string) {
    setSelectedDocumentId(documentId)
    setSelectedPage('all')
    setQuery('')
  }

  function openPractice(kind: 'flashcards' | 'quiz') {
    setPracticeKind(kind)
    setRestoredPractice(null)
    setRestoredSummary(null)
    setActiveTab('practice')
  }

  function openSummary() {
    setRestoredSummary(null)
    setRestoredPractice(null)
    setActiveTab('summary')
  }

  function openPracticeHistory(entry: PracticeHistoryEntry) {
    if (entry.set.kind === 'summary') {
      setRestoredSummary(entry)
      setRestoredPractice(null)
      setActiveTab('summary')
    } else {
      setPracticeKind(entry.set.kind)
      setRestoredPractice(entry)
      setRestoredSummary(null)
      setActiveTab('practice')
    }
  }

  return (
    <section className="document-view">
      <div className="study-workspace">
        <div className="workspace-main">
          <div className="workspace-topbar">
            <div className="success-label"><Check size={14} /> {documents.length} {documents.length === 1 ? 'PDF pronto' : 'PDFs prontos'} · {totalChunks} trechos</div>
            <div className="document-heading-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onAddFile(file)
              event.target.value = ''
            }}
          />
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            <FilePlus2 size={16} /> Adicionar PDF
          </button>
          <button className="secondary-button" onClick={onReplace}>
            <RotateCcw size={16} /> Nova conversa
          </button>
            </div>
          </div>

          <div className="document-card">
        <div className="document-selector" aria-label="Documentos da conversa">
          {documents.map((item) => (
            <button
              key={item.id}
              className={item.id === document.id ? 'is-active' : ''}
              onClick={() => selectDocument(item.id)}
              title={item.name}
            >
              <FileText size={15} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        <div className="document-summary">
          <span className="pdf-icon"><FileText size={24} /></span>
          <div className="file-details">
            <strong title={document.name}>{document.name}</strong>
            <span>{formatSize(document.size)} · {document.pageCount} {document.pageCount === 1 ? 'página' : 'páginas'}</span>
          </div>
          <div className="extraction-status">
            <FileCheck2 size={16} /> {document.chunkCount} trechos indexados
          </div>
        </div>

        <div className="document-tabs" role="tablist" aria-label="Visualização do documento">
          <button className={activeTab === 'chat' ? 'is-active' : ''} onClick={() => setActiveTab('chat')} role="tab" aria-selected={activeTab === 'chat'}>
            <MessageCircleQuestion size={16} /> Conversar com o material
          </button>
          <button className={activeTab === 'text' ? 'is-active' : ''} onClick={() => setActiveTab('text')} role="tab" aria-selected={activeTab === 'text'}>
            <FileText size={16} /> Texto extraído
          </button>
          <button className={activeTab === 'pdf' ? 'is-active' : ''} onClick={() => setActiveTab('pdf')} role="tab" aria-selected={activeTab === 'pdf'}>
            <ScanEye size={16} /> Ver PDF
          </button>
        </div>

        <div hidden={activeTab !== 'chat'}>
          <DocumentChat
            conversationId={conversationId}
            documents={documents}
            messages={messages}
            onMessagesChange={onMessagesChange}
            onNewConversation={onNewConversation}
          />
        </div>
        <div hidden={activeTab !== 'practice'}>
          <PracticePanel
            conversationId={conversationId}
            kind={practiceKind}
            restoredSet={restoredPractice && restoredPractice.set.kind !== 'summary' ? restoredPractice.set : null}
            onKindChange={openPractice}
          />
        </div>
        <div hidden={activeTab !== 'summary'}>
          <SummaryPanel
            conversationId={conversationId}
            restoredSummary={restoredSummary?.set.kind === 'summary' ? restoredSummary.set : null}
          />
        </div>
        <div hidden={activeTab !== 'text'}>
          <div className="document-toolbar">
            <label className="search-box">
              <Search size={16} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no documento selecionado" />
            </label>
            <label className="page-select">
              <select value={selectedPage} onChange={(event) => setSelectedPage(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
                <option value="all">Todas as páginas</option>
                {document.pages.map((page) => <option key={page.pageNumber} value={page.pageNumber}>Página {page.pageNumber}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
          <div className="page-list">
            {visiblePages.length > 0 ? visiblePages.map((page) => (
              <article className="page-content" key={page.pageNumber}>
                <div className="page-divider"><span>PÁGINA {page.pageNumber}</span></div>
                {page.text ? <p>{page.text}</p> : <p className="empty-page">Esta página não contém texto extraível.</p>}
              </article>
            )) : (
              <div className="no-results"><Search size={22} /><p>Nenhuma página contém “{query}”.</p></div>
            )}
          </div>
        </div>
        <div hidden={activeTab !== 'pdf'}>
          {pdfUrl ? (
            <div className="pdf-viewer">
              <div className="pdf-viewer-toolbar">
                <span><ScanEye size={15} /> Visualizando {document.name}</span>
                <a href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir em nova aba</a>
              </div>
              <iframe src={`${pdfUrl}#toolbar=1&navpanes=0`} title={`PDF ${document.name}`} />
            </div>
          ) : (
            <div className="pdf-unavailable">
              <FileQuestion size={30} />
              <strong>PDF original não disponível</strong>
              <p>Esta conversa foi criada antes da visualização de PDFs. Adicione o arquivo novamente para poder vê-lo aqui.</p>
            </div>
          )}
        </div>
      </div>
        </div>
        <StudyToolsPanel
          conversationId={conversationId}
          onCreatePractice={openPractice}
          onCreateSummary={openSummary}
          onOpenHistory={openPracticeHistory}
        />
      </div>
    </section>
  )
}
