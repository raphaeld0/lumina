import { useMemo, useState } from 'react'
import { Check, FileText, Menu, MessageSquareText, Moon, PanelLeftClose, Pencil, Plus, Search, Sun, Trash2, X } from 'lucide-react'
import type { ConversationSummary } from '../types'
import { Brand } from './Brand'

type SidebarProps = {
  isOpen: boolean
  isCollapsed: boolean
  studentName: string
  theme: 'light' | 'dark'
  conversations: ConversationSummary[]
  activeConversationId?: string
  onClose: () => void
  onCollapse: () => void
  onNewConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onStudentNameChange: (name: string) => void
  onThemeChange: (theme: 'light' | 'dark') => void
}

export function Sidebar({
  isOpen,
  isCollapsed,
  studentName,
  theme,
  conversations,
  activeConversationId,
  onClose,
  onCollapse,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onStudentNameChange,
  onThemeChange,
}: SidebarProps) {
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const displayName = studentName.trim() || 'Estudante'
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return conversations
    return conversations.filter((conversation) =>
      `${conversation.title} ${conversation.documentName}`.toLocaleLowerCase('pt-BR').includes(normalized),
    )
  }, [conversations, query])

  return (
    <>
      <button className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`} aria-label="Fechar menu" onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <div className="sidebar-top-actions">
            <button className="icon-button collapse-sidebar" onClick={onCollapse} aria-label="Recolher barra lateral" title="Recolher barra lateral"><PanelLeftClose size={19} /></button>
            <button className="icon-button close-sidebar" onClick={onClose} aria-label="Fechar menu"><X size={20} /></button>
          </div>
        </div>

        <button className="new-conversation" onClick={onNewConversation}><Plus size={17} />Nova conversa</button>

        <label className="conversation-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversas" />
        </label>

        <nav className="conversation-list" aria-label="Conversas">
          <p className="sidebar-label">Recentes</p>
          {filteredConversations.length > 0 ? filteredConversations.map((conversation) => (
            <div className={`conversation-entry ${activeConversationId === conversation.id ? 'is-active' : ''}`} key={conversation.id}>
              <button className="conversation-item" onClick={() => onSelectConversation(conversation.id)}>
                <MessageSquareText size={16} />
                <span title={conversation.title}>{conversation.title}</span>
              </button>
              <div className="conversation-meta-row">
                <div className="conversation-document">
                  <FileText size={14} />
                  <span title={conversation.documentName}>{conversation.documentName}</span>
                </div>
                <div className="conversation-actions">
                  <button onClick={() => onRenameConversation(conversation.id)} aria-label={`Renomear ${conversation.title}`} title="Renomear"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteConversation(conversation.id)} aria-label={`Excluir ${conversation.title}`} title="Excluir"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          )) : (
            <div className="conversation-empty">{conversations.length ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa salva.'}</div>
          )}
        </nav>

        <div className="sidebar-account">
          {settingsOpen && (
            <div className="profile-menu" role="dialog" aria-label="Configurações do perfil">
              <div className="profile-menu-heading">
                <strong>Configurações</strong>
                <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Fechar configurações"><X size={16} /></button>
              </div>
              <label className="profile-name-field">
                <span>Seu nome</span>
                <input
                  value={studentName}
                  onChange={(event) => onStudentNameChange(event.target.value.slice(0, 40))}
                  placeholder="Como quer ser chamado?"
                  maxLength={40}
                />
              </label>
              <div className="theme-setting">
                <span>Tema</span>
                <div className="theme-options">
                  <button className={theme === 'light' ? 'is-active' : ''} onClick={() => onThemeChange('light')}>
                    <Sun size={15} /> Claro {theme === 'light' && <Check size={13} />}
                  </button>
                  <button className={theme === 'dark' ? 'is-active' : ''} onClick={() => onThemeChange('dark')}>
                    <Moon size={15} /> Escuro {theme === 'dark' && <Check size={13} />}
                  </button>
                </div>
              </div>
            </div>
          )}
          <button className="sidebar-footer" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>
            <div className="avatar">{displayName.charAt(0).toLocaleUpperCase('pt-BR')}</div>
            <div><strong>{displayName}</strong><span>Dados salvos neste navegador</span></div>
            <Menu size={17} />
          </button>
        </div>
      </aside>
    </>
  )
}
