import { useEffect, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react'
import { AlertCircle, BookOpen, Bot, LoaderCircle, MessageSquarePlus, Mic, MicOff, Send, Sparkles, UserRound, Volume2, VolumeX } from 'lucide-react'
import { buildContextualSearchQuery } from '../lib/conversation'
import { askDocument, rewriteDocumentQuery } from '../lib/rag'
import { isRewrittenQueryRelated, resolveAcronymsInQuestion, searchRelevantChunks } from '../lib/search'
import type { ChatMessage, PdfDocumentData } from '../types'

type DocumentChatProps = {
  conversationId: string
  documents: PdfDocumentData[]
  messages: ChatMessage[]
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>
  onNewConversation: () => void
}

function newMessageId() {
  return crypto.randomUUID()
}

export function DocumentChat({ conversationId, documents, messages, onMessagesChange: setMessages, onNewConversation }: DocumentChatProps) {
  const [question, setQuestion] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [answerStage, setAnswerStage] = useState<'rewriting' | 'searching' | 'answering' | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const recognitionRef = useRef<LuminaSpeechRecognition | null>(null)

  useEffect(() => () => {
    isMountedRef.current = false
    recognitionRef.current?.abort()
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [isAnswering, messages])

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault()
    const content = question.trim()
    if (content.length < 3 || isAnswering) return
    recognitionRef.current?.stop()

    const userMessage: ChatMessage = { id: newMessageId(), role: 'user', content }
    const conversationBeforeQuestion = messages.filter((message) => message.id !== 'welcome')
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setIsAnswering(true)
    setAnswerStage('rewriting')

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

      setAnswerStage('searching')
      const chunks = await searchRelevantChunks(conversationId, rewrittenQuery, 3)
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

      setAnswerStage('answering')
      const result = await askDocument(
        questionForModel,
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
      if (isMountedRef.current) {
        setIsAnswering(false)
        setAnswerStage(null)
      }
    }
  }

  function startNewConversation() {
    if (isAnswering) return
    recognitionRef.current?.abort()
    window.speechSynthesis?.cancel()
    setQuestion('')
    onNewConversation()
  }

  function toggleVoiceInput() {
    setVoiceError('')
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceError('O reconhecimento de voz não é compatível com este navegador.')
      return
    }

    const recognition = new Recognition()
    const initialQuestion = question.trim()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setVoiceError(event.error === 'not-allowed'
          ? 'Permita o acesso ao microfone para usar a digitação por voz.'
          : 'Não foi possível reconhecer sua voz. Tente novamente.')
      }
      setIsListening(false)
    }
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? ''
      }
      setQuestion([initialQuestion, transcript.trim()].filter(Boolean).join(' ').slice(0, 1500))
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setVoiceError('Não foi possível iniciar o microfone. Tente novamente.')
    }
  }

  function toggleAnswerSpeech(message: ChatMessage) {
    if (!('speechSynthesis' in window)) {
      setVoiceError('A leitura em voz alta não é compatível com este navegador.')
      return
    }

    if (speakingMessageId === message.id) {
      window.speechSynthesis.cancel()
      setSpeakingMessageId(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.lang = 'pt-BR'
    utterance.rate = 0.95
    const portugueseVoice = window.speechSynthesis.getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('pt-br'))
    if (portugueseVoice) utterance.voice = portugueseVoice
    utterance.onend = () => setSpeakingMessageId((current) => current === message.id ? null : current)
    utterance.onerror = () => setSpeakingMessageId((current) => current === message.id ? null : current)
    setSpeakingMessageId(message.id)
    window.speechSynthesis.speak(utterance)
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
          <span>{documents.reduce((total, document) => total + document.chunkCount, 0)} trechos em {documents.length} {documents.length === 1 ? 'PDF' : 'PDFs'}</span>
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
              {message.role === 'assistant' ? (
                <div className="message-answer">
                  <p>{message.content}</p>
                  <button
                    type="button"
                    className="answer-speech-button"
                    onClick={() => toggleAnswerSpeech(message)}
                    aria-label={speakingMessageId === message.id ? 'Parar leitura da resposta' : 'Ouvir resposta'}
                    title={speakingMessageId === message.id ? 'Parar leitura' : 'Ouvir resposta'}
                  >
                    {speakingMessageId === message.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                </div>
              ) : <p>{message.content}</p>}

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
              <div className="answer-progress">
                <div className="typing-indicator"><i /><i /><i /></div>
                <span>{answerStage === 'rewriting'
                  ? 'Entendendo sua pergunta…'
                  : answerStage === 'searching'
                    ? 'Buscando nos documentos…'
                    : 'Gerando resposta com as fontes…'}</span>
              </div>
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
        <button
          type="button"
          className={`voice-input-button ${isListening ? 'is-listening' : ''}`}
          onClick={toggleVoiceInput}
          disabled={isAnswering}
          aria-label={isListening ? 'Parar reconhecimento de voz' : 'Digitar usando o microfone'}
          title={isListening ? 'Parar de ouvir' : 'Usar microfone'}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button className="send-button" type="submit" disabled={question.trim().length < 3 || isAnswering} aria-label="Enviar pergunta">
          {isAnswering ? <LoaderCircle className="search-spinner" size={18} /> : <Send size={17} />}
        </button>
        <small className={voiceError ? 'voice-error' : ''}>
          {voiceError || (isListening ? 'Ouvindo… fale sua pergunta' : 'Enter para enviar · Shift + Enter para nova linha')}
        </small>
      </form>
    </div>
  )
}
