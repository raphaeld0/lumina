import { useMemo, useState } from 'react'
import { Check, ChevronDown, FileCheck2, FileText, MessageCircleQuestion, RotateCcw, Search } from 'lucide-react'
import type { PdfDocumentData } from '../types'
import { DocumentChat } from './DocumentChat'

type DocumentViewProps = {
  document: PdfDocumentData
  onReplace: () => void
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function DocumentView({ document, onReplace }: DocumentViewProps) {
  const [selectedPage, setSelectedPage] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'text'>('chat')

  const visiblePages = useMemo(() => {
    const pages = selectedPage === 'all'
      ? document.pages
      : document.pages.filter((page) => page.pageNumber === selectedPage)
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalizedQuery) return pages
    return pages.filter((page) => page.text.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
  }, [document.pages, query, selectedPage])

  return (
    <section className="document-view">
      <div className="document-heading">
        <div>
          <div className="success-label"><Check size={14} /> Documento pronto</div>
          <h1>Seu material está pronto<br />para estudar.</h1>
          <p>O texto foi dividido em {document.chunkCount} trechos e indexado por página.</p>
        </div>
        <button className="secondary-button" onClick={onReplace}>
          <RotateCcw size={16} /> Trocar PDF
        </button>
      </div>

      <div className="document-card">
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
          <button
            className={activeTab === 'chat' ? 'is-active' : ''}
            onClick={() => setActiveTab('chat')}
            role="tab"
            aria-selected={activeTab === 'chat'}
          >
            <MessageCircleQuestion size={16} /> Conversar com o material
          </button>
          <button
            className={activeTab === 'text' ? 'is-active' : ''}
            onClick={() => setActiveTab('text')}
            role="tab"
            aria-selected={activeTab === 'text'}
          >
            <FileText size={16} /> Texto extraído
          </button>
        </div>

        {activeTab === 'chat' ? (
          <DocumentChat document={document} />
        ) : (
          <>
            <div className="document-toolbar">
              <label className="search-box">
                <Search size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar no documento"
                />
              </label>
              <label className="page-select">
                <select
                  value={selectedPage}
                  onChange={(event) => setSelectedPage(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                >
                  <option value="all">Todas as páginas</option>
                  {document.pages.map((page) => (
                    <option key={page.pageNumber} value={page.pageNumber}>Página {page.pageNumber}</option>
                  ))}
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
                <div className="no-results">
                  <Search size={22} />
                  <p>Nenhuma página contém “{query}”.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
