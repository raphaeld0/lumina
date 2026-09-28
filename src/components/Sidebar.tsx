import { FileText, Menu, MessageSquareText, Plus, X } from 'lucide-react'
import type { ConversationSummary } from '../types'
import { Brand } from './Brand'

type SidebarProps = {
  isOpen: boolean
  conversations: ConversationSummary[]
  activeConversationId?: string
  onClose: () => void
  onNewConversation: () => void
  onSelectConversation: (conversationId: string) => void
}

export function Sidebar({
  isOpen,
  conversations,
  activeConversationId,
  onClose,
  onNewConversation,
  onSelectConversation,
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
          <p className="sidebar-label">Recentes</p>
          {conversations.length > 0 ? conversations.map((conversation) => (
            <div className="conversation-entry" key={conversation.id}>
              <button
                className={`conversation-item ${activeConversationId === conversation.id ? 'is-active' : ''}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <MessageSquareText size={16} />
                <span title={conversation.title}>{conversation.title}</span>
              </button>
              <div className="conversation-document">
                <FileText size={14} />
                <span title={conversation.documentName}>{conversation.documentName}</span>
              </div>
            </div>
          )) : (
            <div className="conversation-empty">Nenhuma conversa salva.</div>
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
