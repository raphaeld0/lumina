import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, BookOpen, Bot, LoaderCircle, Send, Sparkles, UserRound } from 'lucide-react'
import { askDocument } from '../lib/rag'
import { searchRelevantChunks } from '../lib/search'
import type { ChatMessage, PdfDocumentData } from '../types'

type DocumentChatProps = {
  document: PdfDocumentData
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Já li e indexei seu material. Faça uma pergunta e responderei somente com base no documento.',
  sufficient: true,
  sources: [],
}

function newMessageId() {
  return crypto.randomUUID()
}

export function DocumentChat({ document }: DocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [question, setQuestion] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      const chunks = await searchRelevantChunks(document.id, content, 5)

      if (chunks.length === 0) {
        setMessages((current) => [...current, {
          id: newMessageId(),
          role: 'assistant',
          content: 'Não encontrei informação suficiente no material enviado para responder a essa pergunta.',
          sufficient: false,
          sources: [],
        }])
        return
      }

      const result = await askDocument(content, document.name, chunks, conversationBeforeQuestion)
      setMessages((current) => [...current, {
        id: newMessageId(),
        role: 'assistant',
        content: result.answer,
        sufficient: result.sufficient,
        sources: result.sources,
      }])
    } catch (error) {
      setMessages((current) => [...current, {
        id: newMessageId(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Não foi possível obter uma resposta da IA.',
        sufficient: false,
        sources: [],
      }])
    } finally {
      setIsAnswering(false)
    }
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
        <span>{document.chunkCount} trechos disponíveis</span>
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
