import { useEffect, useState } from 'react'
import { BookOpen, BrainCircuit, CheckCircle2, Layers3, ListChecks, LoaderCircle, RotateCw, Sparkles, XCircle } from 'lucide-react'
import { createPracticeSet } from '../lib/practice'
import { savePracticeHistory } from '../lib/practiceHistory'
import type { PracticeSet } from '../types'

type PracticePanelProps = {
  conversationId: string
  kind: 'flashcards' | 'quiz'
  restoredSet?: PracticeSet | null
  onKindChange: (kind: 'flashcards' | 'quiz') => void
}
type PracticeProgress = { reviewed: number; answered: number; correct: number; sessions: number }

function loadProgress(conversationId: string): PracticeProgress {
  try {
    const saved = localStorage.getItem(`lumina-practice-progress:${conversationId}`)
    return saved ? JSON.parse(saved) as PracticeProgress : { reviewed: 0, answered: 0, correct: 0, sessions: 0 }
  } catch {
    return { reviewed: 0, answered: 0, correct: 0, sessions: 0 }
  }
}

export function PracticePanel({ conversationId, kind, restoredSet, onKindChange }: PracticePanelProps) {
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<number[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [progress, setProgress] = useState(() => loadProgress(conversationId))

  useEffect(() => {
    localStorage.setItem(`lumina-practice-progress:${conversationId}`, JSON.stringify(progress))
  }, [conversationId, progress])

  useEffect(() => {
    if (!restoredSet) return
    setPracticeSet(restoredSet)
    setRevealed([])
    setAnswers({})
    setError('')
  }, [restoredSet])

  function updateProgress(update: (current: PracticeProgress) => PracticeProgress) {
    setProgress(update)
  }

  async function generate() {
    setLoading(true)
    setError('')
    setRevealed([])
    setAnswers({})
    try {
      const generated = await createPracticeSet(conversationId, kind)
      setPracticeSet(generated)
      savePracticeHistory(conversationId, generated)
      updateProgress((current) => ({ ...current, sessions: current.sessions + 1 }))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível criar os exercícios.')
    } finally {
      setLoading(false)
    }
  }

  const visibleSet = practiceSet?.kind === kind ? practiceSet : null
  const answeredCount = Object.keys(answers).length
  const score = visibleSet?.kind === 'quiz'
    ? visibleSet.items.filter((item, index) => answers[index] === item.correctIndex).length
    : 0

  return (
    <div className="practice-panel">
      <div className="practice-header">
        <div className="practice-title">
          <span><BrainCircuit size={20} /></span>
          <div><h2>Praticar o conteúdo</h2><p>Exercícios criados somente a partir dos seus PDFs.</p></div>
        </div>
        <div className="practice-header-actions">
          {(progress.reviewed > 0 || progress.answered > 0) && <span className="practice-progress">{progress.reviewed} revisados · {progress.correct}/{progress.answered} acertos</span>}
          <div className="practice-kind" role="group" aria-label="Tipo de exercício">
            <button className={kind === 'flashcards' ? 'is-active' : ''} onClick={() => onKindChange('flashcards')}><Layers3 size={15} /> Flashcards</button>
            <button className={kind === 'quiz' ? 'is-active' : ''} onClick={() => onKindChange('quiz')}><ListChecks size={15} /> Simulado</button>
          </div>
        </div>
      </div>

      {!visibleSet && !loading && (
        <div className="practice-empty">
          <Sparkles size={26} />
          <strong>{kind === 'flashcards' ? 'Crie cartões para revisar os conceitos' : 'Teste seu conhecimento com questões objetivas'}</strong>
          <p>A geração local pode levar alguns segundos, dependendo do seu computador.</p>
          <button onClick={() => { void generate() }}><BrainCircuit size={16} /> Gerar {kind === 'flashcards' ? 'flashcards' : 'simulado'}</button>
        </div>
      )}

      {loading && (
        <div className="practice-loading"><LoaderCircle size={26} /><strong>Criando exercícios com o material…</strong><p>O Ollama está preparando duas atividades.</p></div>
      )}
      {error && <div className="practice-error"><XCircle size={16} /> {error}</div>}

      {visibleSet?.kind === 'flashcards' && (
        <div className="flashcard-list">
          {visibleSet.items.map((card, index) => {
            const isRevealed = revealed.includes(index)
            return (
              <article className={`flashcard ${isRevealed ? 'is-revealed' : ''}`} key={`${card.front}-${index}`}>
                <span className="practice-number">Cartão {index + 1}</span>
                <h3>{card.front}</h3>
                {isRevealed ? <p>{card.back}</p> : <button onClick={() => {
                  setRevealed((current) => [...current, index])
                  updateProgress((current) => ({ ...current, reviewed: current.reviewed + 1 }))
                }}>Revelar resposta</button>}
                {isRevealed && <PracticeSources sources={card.sources} />}
              </article>
            )
          })}
        </div>
      )}

      {visibleSet?.kind === 'quiz' && (
        <div className="quiz-list">
          <div className="quiz-score"><strong>{score}/{visibleSet.items.length}</strong><span>acertos · {answeredCount} respondidas</span></div>
          {visibleSet.items.map((item, questionIndex) => {
            const selected = answers[questionIndex]
            const answered = selected !== undefined
            return (
              <article className="quiz-question" key={`${item.question}-${questionIndex}`}>
                <span className="practice-number">Questão {questionIndex + 1}</span>
                <h3>{item.question}</h3>
                <div className="quiz-options">
                  {item.options.map((option, optionIndex) => {
                    const isCorrect = answered && optionIndex === item.correctIndex
                    const isWrong = answered && optionIndex === selected && selected !== item.correctIndex
                    return (
                      <button
                        className={`${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`}
                        onClick={() => {
                          setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))
                          updateProgress((current) => ({
                            ...current,
                            answered: current.answered + 1,
                            correct: current.correct + (optionIndex === item.correctIndex ? 1 : 0),
                          }))
                        }}
                        disabled={answered}
                        key={`${option}-${optionIndex}`}
                      >
                        <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                        {isCorrect && <CheckCircle2 size={16} />}{isWrong && <XCircle size={16} />}
                      </button>
                    )
                  })}
                </div>
                {answered && <div className="quiz-explanation"><strong>{selected === item.correctIndex ? 'Resposta correta!' : 'Revise este ponto.'}</strong><p>{item.explanation}</p><PracticeSources sources={item.sources} /></div>}
              </article>
            )
          })}
        </div>
      )}

      {visibleSet && !loading && <button className="regenerate-practice" onClick={() => { void generate() }}><RotateCw size={14} /> Gerar novas atividades</button>}
    </div>
  )
}

function PracticeSources({ sources }: { sources: Array<{ id: string; documentName: string; pageNumber: number }> }) {
  return <div className="practice-sources">{sources.map((source) => <span key={`${source.id}-${source.documentName}`}><BookOpen size={12} /> {source.documentName} · pág. {source.pageNumber}</span>)}</div>
}
