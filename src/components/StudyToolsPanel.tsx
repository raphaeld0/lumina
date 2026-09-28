import { useEffect, useState, type FormEvent } from 'react'
import { Clock3, FileText, Layers3, ListChecks, Sparkles, X } from 'lucide-react'
import { getPracticeHistory, PRACTICE_HISTORY_EVENT, type PracticeHistoryEntry } from '../lib/practiceHistory'

type StudyToolsPanelProps = {
  conversationId: string
  onCreatePractice: (kind: 'flashcards' | 'quiz', topic: string) => void
  onCreateSummary: (topic: string) => void
  onOpenHistory: (entry: PracticeHistoryEntry) => void
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

export function StudyToolsPanel({ conversationId, onCreatePractice, onCreateSummary, onOpenHistory }: StudyToolsPanelProps) {
  const [history, setHistory] = useState(() => getPracticeHistory(conversationId))
  const [selectedTool, setSelectedTool] = useState<'flashcards' | 'quiz' | 'summary' | null>(null)
  const [topic, setTopic] = useState('')

  useEffect(() => {
    setHistory(getPracticeHistory(conversationId))
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: string }>).detail
      if (detail.conversationId === conversationId) setHistory(getPracticeHistory(conversationId))
    }
    window.addEventListener(PRACTICE_HISTORY_EVENT, refresh)
    return () => window.removeEventListener(PRACTICE_HISTORY_EVENT, refresh)
  }, [conversationId])

  function openTopicDialog(tool: 'flashcards' | 'quiz' | 'summary') {
    setSelectedTool(tool)
    setTopic('')
  }

  function submitTopic(event: FormEvent) {
    event.preventDefault()
    const normalizedTopic = topic.trim()
    if (!selectedTool || normalizedTopic.length < 2) return
    if (selectedTool === 'summary') onCreateSummary(normalizedTopic)
    else onCreatePractice(selectedTool, normalizedTopic)
    setSelectedTool(null)
  }

  const toolName = selectedTool === 'flashcards' ? 'flashcards' : selectedTool === 'quiz' ? 'simulado' : 'resumo'

  return (
    <>
    <aside className="study-tools-panel">
      <section className="study-tool-actions">
        <div className="study-tools-heading"><span><Sparkles size={15} /></span><div><strong>Criar material</strong><p>Use seus PDFs para praticar</p></div></div>
        <div className="study-tool-buttons">
          <button onClick={() => openTopicDialog('flashcards')}><Layers3 size={18} /><span><strong>Flashcards</strong><small>Revisão rápida</small></span></button>
          <button onClick={() => openTopicDialog('quiz')}><ListChecks size={18} /><span><strong>Simulado</strong><small>Questões e nota</small></span></button>
          <button onClick={() => openTopicDialog('summary')}><FileText size={18} /><span><strong>Resumo</strong><small>Pontos principais</small></span></button>
        </div>
      </section>

      <section className="study-history">
        <div className="study-history-heading"><div><strong>Histórico</strong><span>{history.length} {history.length === 1 ? 'atividade' : 'atividades'}</span></div><Clock3 size={16} /></div>
        {history.length > 0 ? (
          <div className="study-history-list">
            {history.map((entry) => (
              <button key={entry.id} onClick={() => onOpenHistory(entry)}>
                <span className="history-icon">{entry.set.kind === 'flashcards' ? <Layers3 size={15} /> : entry.set.kind === 'quiz' ? <ListChecks size={15} /> : <FileText size={15} />}</span>
                <span>
                  <strong>{entry.set.kind === 'flashcards' ? 'Flashcards' : entry.set.kind === 'quiz' ? 'Simulado' : 'Resumo'}</strong>
                  <small title={entry.topic}>{entry.topic || (entry.set.kind === 'summary' ? `${entry.set.keyPoints.length} pontos` : `${entry.set.items.length} itens`)} · {formatDate(entry.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="study-history-empty"><Clock3 size={22} /><p>Os materiais gerados aparecerão aqui.</p></div>
        )}
      </section>
    </aside>
    {selectedTool && (
      <div className="topic-dialog-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSelectedTool(null)
      }}>
        <form className="topic-dialog" onSubmit={submitTopic} role="dialog" aria-modal="true" aria-labelledby="topic-dialog-title">
          <button type="button" className="topic-dialog-close" onClick={() => setSelectedTool(null)} aria-label="Fechar"><X size={18} /></button>
          <span className="topic-dialog-icon">{selectedTool === 'flashcards' ? <Layers3 size={22} /> : selectedTool === 'quiz' ? <ListChecks size={22} /> : <FileText size={22} />}</span>
          <h2 id="topic-dialog-title">Criar {toolName}</h2>
          <p>Qual assunto dos seus PDFs você quer estudar?</p>
          <label>
            <span>Assunto</span>
            <input autoFocus value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: RAG, conceitos básicos, redes neurais…" maxLength={200} />
          </label>
          <div className="topic-suggestions">
            {['Conceitos básicos', 'Pontos importantes', 'Definições principais'].map((suggestion) => <button type="button" key={suggestion} onClick={() => setTopic(suggestion)}>{suggestion}</button>)}
          </div>
          <button className="topic-dialog-submit" type="submit" disabled={topic.trim().length < 2}>Continuar</button>
        </form>
      </div>
    )}
    </>
  )
}
