import { useEffect, useState } from 'react'
import { Clock3, FileText, Layers3, ListChecks, Sparkles } from 'lucide-react'
import { getPracticeHistory, PRACTICE_HISTORY_EVENT, type PracticeHistoryEntry } from '../lib/practiceHistory'

type StudyToolsPanelProps = {
  conversationId: string
  onCreatePractice: (kind: 'flashcards' | 'quiz') => void
  onCreateSummary: () => void
  onOpenHistory: (entry: PracticeHistoryEntry) => void
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

export function StudyToolsPanel({ conversationId, onCreatePractice, onCreateSummary, onOpenHistory }: StudyToolsPanelProps) {
  const [history, setHistory] = useState(() => getPracticeHistory(conversationId))

  useEffect(() => {
    setHistory(getPracticeHistory(conversationId))
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: string }>).detail
      if (detail.conversationId === conversationId) setHistory(getPracticeHistory(conversationId))
    }
    window.addEventListener(PRACTICE_HISTORY_EVENT, refresh)
    return () => window.removeEventListener(PRACTICE_HISTORY_EVENT, refresh)
  }, [conversationId])

  return (
    <aside className="study-tools-panel">
      <section className="study-tool-actions">
        <div className="study-tools-heading"><span><Sparkles size={15} /></span><div><strong>Criar material</strong><p>Use seus PDFs para praticar</p></div></div>
        <div className="study-tool-buttons">
          <button onClick={() => onCreatePractice('flashcards')}><Layers3 size={18} /><span><strong>Flashcards</strong><small>Revisão rápida</small></span></button>
          <button onClick={() => onCreatePractice('quiz')}><ListChecks size={18} /><span><strong>Simulado</strong><small>Questões e nota</small></span></button>
          <button onClick={onCreateSummary}><FileText size={18} /><span><strong>Resumo</strong><small>Pontos principais</small></span></button>
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
                  <small>{entry.set.kind === 'summary' ? `${entry.set.keyPoints.length} pontos` : `${entry.set.items.length} itens`} · {formatDate(entry.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="study-history-empty"><Clock3 size={22} /><p>Os materiais gerados aparecerão aqui.</p></div>
        )}
      </section>
    </aside>
  )
}
