import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, LoaderCircle, RotateCw, Sparkles, XCircle } from 'lucide-react'
import { savePracticeHistory } from '../lib/practiceHistory'
import { createSummary } from '../lib/summary'
import type { SummarySet } from '../types'

type SummaryPanelProps = {
  conversationId: string
  generationRequest?: { id: string; topic: string } | null
  restoredSummary?: SummarySet | null
  restoredTopic?: string
}

export function SummaryPanel({ conversationId, generationRequest, restoredSummary, restoredTopic }: SummaryPanelProps) {
  const [summary, setSummary] = useState<SummarySet | null>(restoredSummary ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topic, setTopic] = useState(restoredTopic ?? '')
  const handledRequestRef = useRef<string | null>(null)

  useEffect(() => {
    if (restoredSummary) {
      setSummary(restoredSummary)
      setTopic(restoredTopic ?? '')
    }
  }, [restoredSummary, restoredTopic])

  const generate = useCallback(async (requestedTopic: string) => {
    if (requestedTopic.trim().length < 2) return
    setLoading(true)
    setError('')
    try {
      const generated = await createSummary(conversationId, requestedTopic)
      setSummary(generated)
      setTopic(requestedTopic)
      savePracticeHistory(conversationId, generated, requestedTopic)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível criar o resumo.')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (!generationRequest || handledRequestRef.current === generationRequest.id) return
    handledRequestRef.current = generationRequest.id
    setTopic(generationRequest.topic)
    void generate(generationRequest.topic)
  }, [generate, generationRequest])

  return (
    <div className="summary-panel">
      <div className="summary-panel-heading">
        <span><FileText size={21} /></span>
        <div><h2>Resumo do material</h2><p>Síntese fundamentada nos PDFs desta conversa.</p></div>
      </div>

      {topic && <div className="material-topic"><Sparkles size={12} /> Assunto: <strong>{topic}</strong></div>}

      {!summary && !loading && (
        <div className="summary-empty">
          <Sparkles size={27} />
          <strong>Transforme o material em um resumo de estudo</strong>
          <p>A IA selecionará os conceitos principais e indicará as páginas utilizadas.</p>
          <button onClick={() => { void generate(topic) }} disabled={topic.length < 2}><FileText size={16} /> Gerar resumo</button>
        </div>
      )}
      {loading && <div className="summary-loading"><LoaderCircle size={27} /><strong>Resumindo os documentos…</strong><p>O modelo local está analisando os trechos mais representativos.</p></div>}
      {error && <div className="practice-error"><XCircle size={16} /> {error}</div>}

      {summary && !loading && (
        <article className="generated-summary">
          <span className="practice-number">Resumo gerado</span>
          <h3>{summary.title}</h3>
          <p>{summary.summary}</p>
          <h4>Pontos principais</h4>
          <ul>{summary.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>
          <div className="practice-sources">{summary.sources.map((source) => <span key={`${source.id}-${source.documentName}`}><BookOpen size={12} /> {source.documentName} · pág. {source.pageNumber}</span>)}</div>
        </article>
      )}

      {summary && !loading && <button className="regenerate-practice" onClick={() => { void generate(topic) }} disabled={topic.length < 2}><RotateCw size={14} /> Gerar novo resumo</button>}
    </div>
  )
}
