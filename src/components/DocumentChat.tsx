import { useEffect, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react'
import { AlertCircle, BookOpen, Bot, LoaderCircle, MessageSquarePlus, Send, Sparkles, UserRound } from 'lucide-react'
import { buildContextualSearchQuery } from '../lib/conversation'
import { askDocument, rewriteDocumentQuery } from '../lib/rag'
import { isRewrittenQueryRelated, resolveAcronymsInQuestion, searchRelevantChunks } from '../lib/search'
import type { ChatMessage, PdfDocumentData } from '../types'

type DocumentChatProps = {
  document: PdfDocumentData
  messages: ChatMessage[]
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>
  onNewConversation: () => void
}

function newMessageId() {
  return crypto.randomUUID()
}

export function DocumentChat({ document, messages, onMessagesChange: setMessages, onNewConversation }: DocumentChatProps) {
  const [question, setQuestion] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  useEffect(() => () => {
    isMountedRef.current = false
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [isAnswering, messages])

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault()
    const content = question.trim()
    if (content.length < 3 || isAnswering) return

    const userMessage: ChatMessage = { id: newMessageId(), role: 'user', content }
    const conversationBeforeQuestion = messages.filter((message) => message.id !== 'welcome')
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setIsAnswering(true)

    try {
      const contextualSearch = buildContextualSearchQuery(content, conversationBeforeQuestion)
      let rewrittenQuery = contextualSearch.resolvedQuestion
      try {
        const candidateQuery = await rewriteDocumentQuery(contextualSearch.resolvedQuestion, conversationBeforeQuestion)
        if (isRewrittenQueryRelated(contextualSearch.resolvedQuestion, candidateQuery)) {
          rewrittenQuery = candidateQuery
        }
      } catch {
        // A busca local continua disponível caso a reescrita não responda.
      }

      const chunks = await searchRelevantChunks(document.id, rewrittenQuery, 5)
      const questionForModel = resolveAcronymsInQuestion(rewrittenQuery, chunks)

      if (chunks.length === 0) {
        if (!isMountedRef.current) return
        setMessages((current) => [...current, {
          id: newMessageId(),
          role: 'assistant',
          content: 'Não encontrei informação suficiente no material enviado para responder a essa pergunta.',
          sufficient: false,
          sources: [],
          usedContext: contextualSearch.usedContext,
        }])
        return
      }

      const result = await askDocument(
        questionForModel,
        document.name,
        chunks,
        conversationBeforeQuestion,
      )
      if (!isMountedRef.current) return
      setMessages((current) => [...current, {
        id: newMessageId(),
        role: 'assistant',
        content: result.answer,
        sufficient: result.sufficient,
        sources: result.sources,
        usedContext: contextualSearch.usedContext,
      }])
    } catch (error) {
      if (!isMountedRef.current) return
      setMessages((current) => [...current, {
        id: newMessageId(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Não foi possível obter uma resposta da IA.',
        sufficient: false,
        sources: [],
      }])
    } finally {
      if (isMountedRef.current) setIsAnswering(false)
    }
  }

  function startNewConversation() {
    if (isAnswering) return
    setQuestion('')
    onNewConversation()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitQuestion()
    }
  }

  return (
    <div className="document-chat">
      <div className="chat-context-bar">
        <span><Sparkles size={14} /> Respostas fundamentadas no PDF</span>
        <div className="chat-context-actions">
          <span>{document.chunkCount} trechos disponíveis</span>
          <button type="button" onClick={startNewConversation} disabled={isAnswering}>
            <MessageSquarePlus size={13} /> Nova conversa
          </button>
        </div>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <article className={`chat-message is-${message.role}`} key={message.id}>
            <span className="message-avatar">
              {message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={16} />}
            </span>
            <div className="message-body">
              <span className="message-author">{message.role === 'assistant' ? 'Lumina' : 'Você'}</span>
              <p>{message.content}</p>

              {message.sufficient === false && (
                <div className="insufficient-label"><AlertCircle size={13} /> Informação insuficiente no material</div>
              )}

              {message.usedContext && (
                <div className="context-used-label"><Sparkles size={12} /> Contexto da conversa utilizado</div>
              )}

              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <span className="sources-title">Fontes utilizadas</span>
                  {message.sources.map((source) => (
                    <details className="source-reference" key={`${message.id}-${source.id}`}>
                      <summary>
                        <BookOpen size={13} />
                        <span>{source.documentName}</span>
                        <strong>Página {source.pageNumber}</strong>
                      </summary>
                      <p>{source.text}</p>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}

        {isAnswering && (
          <article className="chat-message is-assistant is-typing">
            <span className="message-avatar"><Bot size={17} /></span>
            <div className="message-body">
              <span className="message-author">Lumina</span>
              <div className="typing-indicator"><i /><i /><i /></div>
            </div>
          </article>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-composer" onSubmit={submitQuestion}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte alguma coisa sobre o documento…"
          rows={1}
          maxLength={1500}
          aria-label="Mensagem para o chat"
        />
        <button type="submit" disabled={question.trim().length < 3 || isAnswering} aria-label="Enviar pergunta">
          {isAnswering ? <LoaderCircle className="search-spinner" size={18} /> : <Send size={17} />}
        </button>
        <small>Enter para enviar · Shift + Enter para nova linha</small>
      </form>
    </div>
  )
}
