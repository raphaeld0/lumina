import { FileText, Menu, MessageSquareText, Plus, X } from 'lucide-react'
import { Brand } from './Brand'

type SidebarProps = {
  isOpen: boolean
  documentName?: string
  onClose: () => void
  onNewConversation: () => void
}

export function Sidebar({
  isOpen,
  documentName,
  onClose,
  onNewConversation,
}: SidebarProps) {
  return (
    <>
      <button
        className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`}
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button close-sidebar" onClick={onClose} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <button className="new-conversation" onClick={onNewConversation}>
          <Plus size={17} />
          Nova conversa
        </button>

        <nav className="conversation-list" aria-label="Conversas">
          <p className="sidebar-label">Hoje</p>
          <button className="conversation-item is-active">
            <MessageSquareText size={16} />
            <span>{documentName ? 'Estudo do documento' : 'Nova conversa'}</span>
          </button>
          {documentName && (
            <div className="conversation-document">
              <FileText size={14} />
              <span title={documentName}>{documentName}</span>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">E</div>
          <div>
            <strong>Estudante</strong>
            <span>Plano gratuito</span>
          </div>
          <Menu size={17} />
        </div>
      </aside>
    </>
  )
}
